// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
import fs from 'node:fs';
import type { SnapshotFile } from './types.js';
import { partitionApplicable } from './operations.js';
import { hashFile, readSnapshotManifest } from './snapshot.js';
import type { ContextStore } from './store.js';
import { applySnapshot, workingAbs } from './working-tree.js';

const CONFLICT_PREVIEW_COUNT = 5;

export interface MergeOptions {
  /** Take the snapshot's version of conflicting files. */
  overwrite?: boolean;
  dryRun?: boolean;
}

export class MergeConflictError extends Error {
  constructor(public readonly conflicts: string[]) {
    super(
      `${conflicts.length} file(s) exist with different content; pass --overwrite to take the snapshot's version. ` +
        `First: ${conflicts.slice(0, CONFLICT_PREVIEW_COUNT).join(', ')}`,
    );
    this.name = 'MergeConflictError';
  }
}

export interface MergeResult {
  label: string;
  written: string[];
  unchanged: string[];
  conflicts: string[];
  skipped: string[];
  dryRun: boolean;
}

/**
 * Copy a snapshot's files over the working tree. A working-tree edit only: the active
 * pointer is untouched, so `status` reports the merged files as unsaved changes.
 */
export function merge(store: ContextStore, label: string, options: MergeOptions = {}): MergeResult {
  const ref = store.require(label);
  const manifest = readSnapshotManifest(ref.dir);
  const { applicable, skipped } = partitionApplicable(store, manifest);

  const toWrite: SnapshotFile[] = [];
  const unchanged: string[] = [];
  const conflicts: string[] = [];
  for (const file of applicable) {
    const abs = workingAbs(store.projectRoot, file.path);
    if (!fs.existsSync(abs)) {
      toWrite.push(file);
    } else if (hashFile(abs) === file.sha256) {
      unchanged.push(file.path);
    } else {
      conflicts.push(file.path);
      toWrite.push(file);
    }
  }
  if (conflicts.length > 0 && !options.overwrite) throw new MergeConflictError(conflicts);

  const result: MergeResult = {
    label: ref.label,
    written: toWrite.map((f) => f.path),
    unchanged,
    conflicts,
    skipped,
    dryRun: options.dryRun === true,
  };
  if (options.dryRun) return result;
  result.written = applySnapshot(store.projectRoot, ref.dir, toWrite);
  return result;
}

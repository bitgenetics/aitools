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
import path from 'node:path';
import type { Catalog, ContextState, SnapshotFile } from './types.js';
import { classify } from './catalog.js';
import { toProjectRel } from './ignore-glob.js';
import { hashFile, snapshotFileAbs } from './snapshot.js';

export interface FileDiff {
  /** In actual, not in expected. */
  added: string[];
  /** In expected, not in actual. */
  removed: string[];
  /** In both with different hashes. */
  changed: string[];
}

export class OutsideCatalogError extends Error {
  constructor(
    public readonly filePath: string,
    reason: string,
  ) {
    super(`Snapshot path "${filePath}" ${reason}. Snapshots may only contain AI-mech paths inside the project.`);
    this.name = 'OutsideCatalogError';
  }
}

export function workingAbs(root: string, rel: string): string {
  return path.join(root, ...toProjectRel(rel).split('/'));
}

/** Hash every cataloged file as it is on disk now. */
export function hashWorkingTree(catalog: Catalog): SnapshotFile[] {
  return catalog.entries.map((e) => ({ path: e.path, sha256: hashFile(workingAbs(catalog.root, e.path)) }));
}

export function diffFiles(expected: readonly SnapshotFile[], actual: readonly SnapshotFile[]): FileDiff {
  const want = new Map(expected.map((f) => [f.path, f.sha256]));
  const have = new Map(actual.map((f) => [f.path, f.sha256]));
  const diff: FileDiff = { added: [], removed: [], changed: [] };
  for (const [p, hash] of have) {
    const exp = want.get(p);
    if (exp === undefined) diff.added.push(p);
    else if (exp !== hash) diff.changed.push(p);
  }
  for (const p of want.keys()) {
    if (!have.has(p)) diff.removed.push(p);
  }
  return diff;
}

/** Cataloged paths that differ from what the tool last saved or applied. */
export function dirtyPaths(catalog: Catalog, state: ContextState): string[] {
  const d = diffFiles(state.files, hashWorkingTree(catalog));
  return [...d.added, ...d.changed, ...d.removed].sort((a, b) => a.localeCompare(b));
}

/** Throw unless `rel` resolves inside root and is a known AI-mech kind. */
export function assertCatalogPath(root: string, rel: string): void {
  const normalized = toProjectRel(rel);
  if (!normalized || path.isAbsolute(normalized)) {
    throw new OutsideCatalogError(rel, 'is not project-relative');
  }
  const resolvedRoot = path.resolve(root);
  const abs = path.resolve(resolvedRoot, ...normalized.split('/'));
  if (abs !== resolvedRoot && !abs.startsWith(resolvedRoot + path.sep)) {
    throw new OutsideCatalogError(rel, 'resolves outside the project root');
  }
  if (classify(normalized) === null) {
    throw new OutsideCatalogError(rel, 'is not a known AI-mech path');
  }
}

function pruneEmptyDirs(root: string, fileAbs: string): void {
  let dir = path.dirname(fileAbs);
  while (dir !== root && dir.startsWith(root)) {
    try {
      if (fs.readdirSync(dir).length > 0) return;
      fs.rmdirSync(dir);
    } catch {
      return;
    }
    dir = path.dirname(dir);
  }
}

/** Delete every cataloged file (ignored paths are not in the catalog, so they survive). */
export function clearWorkingTree(catalog: Catalog): string[] {
  const removed: string[] = [];
  for (const entry of catalog.entries) {
    const abs = workingAbs(catalog.root, entry.path);
    if (!fs.existsSync(abs)) continue;
    fs.unlinkSync(abs);
    removed.push(entry.path);
    pruneEmptyDirs(catalog.root, abs);
  }
  return removed;
}

/** Copy the listed snapshot files into the working tree. Callers validate paths first. */
export function applySnapshot(root: string, snapshotDir: string, files: readonly SnapshotFile[]): string[] {
  const written: string[] = [];
  for (const file of files) {
    const src = snapshotFileAbs(snapshotDir, file.path);
    const dest = workingAbs(root, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    written.push(file.path);
  }
  return written;
}

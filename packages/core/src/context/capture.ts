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
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AiMechInventory } from './types.js';
import { snapshotsRoot } from './paths.js';
import { toProjectRel } from './stay.js';

export interface ContextSnapshot {
  id: string;
  createdAt: string;
  root: string;
  fileHashes: Record<string, string>;
}

function hashFile(abs: string): string {
  const buf = fs.readFileSync(abs);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function newSnapshotId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(3).toString('hex');
  return `snap-${stamp}-${rand}`;
}

/**
 * Record SHA-256 hashes of cataloged AI-mech files and optionally copy bytes
 * under `.aitools/context-snapshots/<id>/`.
 */
export function captureContext(
  projectRoot: string,
  inventory: AiMechInventory,
  options: { copyFiles?: boolean } = {},
): ContextSnapshot {
  const root = path.resolve(projectRoot);
  const id = newSnapshotId();
  const fileHashes: Record<string, string> = {};
  const snapDir = path.join(snapshotsRoot(root), id);

  if (options.copyFiles) {
    fs.mkdirSync(snapDir, { recursive: true });
  }

  for (const entry of inventory.entries) {
    const rel = toProjectRel(entry.path);
    const abs = path.join(root, ...rel.split('/'));
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    fileHashes[rel] = hashFile(abs);
    if (options.copyFiles) {
      const dest = path.join(snapDir, ...rel.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
    }
  }

  const snapshot: ContextSnapshot = {
    id,
    createdAt: new Date().toISOString(),
    root,
    fileHashes,
  };

  fs.mkdirSync(snapshotsRoot(root), { recursive: true });
  fs.writeFileSync(
    path.join(snapshotsRoot(root), `${id}.json`),
    JSON.stringify(snapshot, null, 2) + '\n',
    'utf8',
  );
  return snapshot;
}

export function readSnapshot(projectRoot: string, id: string): ContextSnapshot | null {
  const file = path.join(snapshotsRoot(projectRoot), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ContextSnapshot;
}

/** Compare current inventory hashes to a snapshot; returns dirty relative paths. */
export function dirtyVsSnapshot(
  projectRoot: string,
  inventory: AiMechInventory,
  snapshot: ContextSnapshot,
): string[] {
  const root = path.resolve(projectRoot);
  const dirty: string[] = [];
  for (const entry of inventory.entries) {
    const rel = toProjectRel(entry.path);
    const abs = path.join(root, ...rel.split('/'));
    const expected = snapshot.fileHashes[rel];
    if (!expected) continue;
    if (!fs.existsSync(abs)) {
      dirty.push(rel);
      continue;
    }
    if (hashFile(abs) !== expected) dirty.push(rel);
  }
  return dirty;
}

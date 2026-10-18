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
import type { SnapshotFile, SnapshotManifest, SnapshotOrigin } from './types.js';
import { SNAPSHOT_MANIFEST_FILE } from './paths.js';
import { toProjectRel } from './ignore-glob.js';

/** One file to copy into a snapshot: its project-relative path and where to read the bytes from. */
export interface SnapshotSource {
  path: string;
  srcAbs: string;
}

export interface SnapshotMeta {
  label: string | null;
  origin?: SnapshotOrigin;
}

export class SnapshotNotFoundError extends Error {
  constructor(public readonly dir: string) {
    super(`No snapshot at ${dir}`);
    this.name = 'SnapshotNotFoundError';
  }
}

export function hashFile(abs: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

export function snapshotExists(dir: string): boolean {
  return fs.existsSync(path.join(dir, SNAPSHOT_MANIFEST_FILE));
}

export function snapshotFileAbs(dir: string, rel: string): string {
  return path.join(dir, ...toProjectRel(rel).split('/'));
}

export function readSnapshotManifest(dir: string): SnapshotManifest {
  const file = path.join(dir, SNAPSHOT_MANIFEST_FILE);
  if (!fs.existsSync(file)) throw new SnapshotNotFoundError(dir);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SnapshotManifest;
}

/**
 * Write a snapshot folder. Builds into a temporary sibling and renames into place, so
 * an existing snapshot at `dir` is replaced whole or not at all.
 */
export function writeSnapshot(dir: string, sources: SnapshotSource[], meta: SnapshotMeta): SnapshotManifest {
  const parent = path.dirname(dir);
  fs.mkdirSync(parent, { recursive: true });
  const tmp = path.join(parent, `.tmp-${path.basename(dir)}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(tmp, { recursive: true });

  const files: SnapshotFile[] = [];
  try {
    for (const src of sources) {
      const rel = toProjectRel(src.path);
      const dest = snapshotFileAbs(tmp, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src.srcAbs, dest);
      files.push({ path: rel, sha256: hashFile(dest) });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    const manifest: SnapshotManifest = {
      label: meta.label,
      createdAt: new Date().toISOString(),
      ...(meta.origin ? { origin: meta.origin } : {}),
      files,
    };
    fs.writeFileSync(path.join(tmp, SNAPSHOT_MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
    return manifest;
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
}

export function removeSnapshot(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

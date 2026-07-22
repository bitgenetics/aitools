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
import type { QuarantineManifest, QuarantineMove } from './types.js';
import { quarantineDir, quarantineRoot, QUARANTINE_MANIFEST_FILE } from './paths.js';
import { toProjectRel } from './stay.js';

function moveFile(fromAbs: string, toAbs: string): void {
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  try {
    fs.renameSync(fromAbs, toAbs);
  } catch {
    fs.copyFileSync(fromAbs, toAbs);
    fs.unlinkSync(fromAbs);
  }
}

function newQuarantineId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(4).toString('hex');
  return `${stamp}-${rand}`;
}

/**
 * Move project-relative files into `.aitools/context-quarantine/<id>/`.
 * Returns the quarantine manifest (also written to disk).
 */
export function quarantineFiles(projectRoot: string, relPaths: string[]): QuarantineManifest {
  const root = path.resolve(projectRoot);
  const id = newQuarantineId();
  const qDir = quarantineDir(root, id);
  fs.mkdirSync(qDir, { recursive: true });

  const moves: QuarantineMove[] = [];
  for (const rel of relPaths) {
    const from = toProjectRel(rel);
    const fromAbs = path.join(root, ...from.split('/'));
    if (!fs.existsSync(fromAbs) || !fs.statSync(fromAbs).isFile()) continue;
    const to = from;
    const toAbs = path.join(qDir, ...to.split('/'));
    moveFile(fromAbs, toAbs);
    moves.push({ from, to });
  }

  const manifest: QuarantineManifest = {
    id,
    createdAt: new Date().toISOString(),
    root,
    moves,
  };
  fs.writeFileSync(
    path.join(qDir, QUARANTINE_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
  return manifest;
}

/** Restore files from a quarantine id back into the project tree. */
export function restoreQuarantine(projectRoot: string, id: string): QuarantineManifest {
  const root = path.resolve(projectRoot);
  const qDir = quarantineDir(root, id);
  const manifestPath = path.join(qDir, QUARANTINE_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Quarantine "${id}" not found at ${qDir}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as QuarantineManifest;
  for (const move of manifest.moves) {
    const fromAbs = path.join(qDir, ...move.to.split('/'));
    const destAbs = path.join(root, ...move.from.split('/'));
    if (!fs.existsSync(fromAbs)) continue;
    moveFile(fromAbs, destAbs);
  }
  // Remove empty quarantine dir after restore
  try {
    fs.rmSync(qDir, { recursive: true, force: true });
  } catch {
    // leave remnants if busy
  }
  return manifest;
}

/** True when a quarantine id exists on disk. */
export function quarantineExists(projectRoot: string, id: string): boolean {
  return fs.existsSync(path.join(quarantineDir(projectRoot, id), QUARANTINE_MANIFEST_FILE));
}

/** Ensure `.aitools/context-quarantine` parent exists (for gitignore awareness). */
export function ensureQuarantineRoot(projectRoot: string): string {
  const root = quarantineRoot(projectRoot);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

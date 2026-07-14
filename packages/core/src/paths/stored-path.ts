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
import os from 'node:os';
import path from 'node:path';

/** Normalize a path string to forward slashes for JSON storage. */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function isWithinRoot(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel);
}

/**
 * Convert a filesystem path to a portable stored form for aitools.json / aitools-lock.json.
 *
 * - Paths under `projectRoot` are stored relative to it (forward slashes).
 * - Paths under the user home directory are stored as `~/...`.
 * - Already-relative or `~/` paths are normalized to posix form.
 * - Absolute legacy paths are re-encoded when possible; never written back as absolute.
 */
export function toStoredPath(
  projectRoot: string,
  filePath: string,
  homeDir: string = os.homedir(),
): string {
  if (filePath.startsWith('~/')) {
    return `~/${toPosixPath(filePath.slice(2))}`;
  }
  if (filePath === '~') {
    return '~';
  }

  if (!path.isAbsolute(filePath)) {
    return toPosixPath(filePath);
  }

  const absFile = path.resolve(filePath);
  const absRoot = path.resolve(projectRoot);
  const absHome = path.resolve(homeDir);

  if (isWithinRoot(absRoot, absFile) || absFile === absRoot) {
    const fromRoot = path.relative(absRoot, absFile);
    return fromRoot === '' ? '.' : toPosixPath(fromRoot);
  }

  if (isWithinRoot(absHome, absFile) || absFile === absHome) {
    const fromHome = path.relative(absHome, absFile);
    return fromHome === ''
      ? '~'
      : `~/${toPosixPath(fromHome)}`;
  }

  const fromRoot = path.relative(absRoot, absFile);
  if (!path.isAbsolute(fromRoot)) {
    return toPosixPath(fromRoot);
  }

  throw new Error(
    `Cannot store absolute path outside project and home: ${filePath}`,
  );
}

/** Resolve a stored path from aitools.json or aitools-lock.json back to an absolute path. */
export function resolveStoredPath(
  projectRoot: string,
  storedPath: string,
  homeDir: string = os.homedir(),
): string {
  if (storedPath.startsWith('~/')) {
    return path.join(homeDir, ...storedPath.slice(2).split('/'));
  }
  if (storedPath === '~') {
    return homeDir;
  }
  if (path.isAbsolute(storedPath)) {
    return storedPath;
  }
  return path.resolve(projectRoot, storedPath.split('/').join(path.sep));
}

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
import { spawnSync } from 'node:child_process';
import { toProjectRel } from './stay.js';

/**
 * Return tracked AI-mech paths that have uncommitted changes (git porcelain).
 * If git is unavailable or cwd is not a repo, returns [].
 */
export function dirtyTrackedAiMechPaths(projectRoot: string, relPaths: string[]): string[] {
  if (relPaths.length === 0) return [];
  const result = spawnSync('git', ['status', '--porcelain', '--', ...relPaths], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.status !== 0) {
    // Not a git repo or git missing — treat as clean (caller may still use --force).
    return [];
  }
  const dirty = new Set<string>();
  const lines = (result.stdout ?? '').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    // format: XY path  or  XY orig -> path — ignore untracked/ignored (not "tracked" dirt).
    const code = line.slice(0, 2);
    if (code === '??' || code === '!!') continue;
    const rest = line.slice(3).trim();
    const arrow = rest.indexOf(' -> ');
    const filePart = arrow >= 0 ? rest.slice(arrow + 4) : rest;
    dirty.add(toProjectRel(filePart.replace(/^"|"$/g, '')));
  }
  return relPaths.filter((p) => dirty.has(toProjectRel(p)));
}

export class DirtyTreeError extends Error {
  constructor(public readonly paths: string[]) {
    super(
      `Refusing context operation: ${paths.length} tracked AI-mech path(s) have uncommitted changes. ` +
        `Commit them or pass --force. First: ${paths.slice(0, 3).join(', ')}`,
    );
    this.name = 'DirtyTreeError';
  }
}

export function assertCleanAiMechTree(
  projectRoot: string,
  relPaths: string[],
  force: boolean,
): void {
  if (force) return;
  const dirty = dirtyTrackedAiMechPaths(projectRoot, relPaths);
  if (dirty.length > 0) throw new DirtyTreeError(dirty);
}

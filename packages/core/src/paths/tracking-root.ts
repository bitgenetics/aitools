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
import type { InstallScope } from '../types/tool.js';

/**
 * User-level aitools tooling root: manifest, lock, cache, and related state.
 * IDE element payloads live under platform vendor dirs, not here.
 */
export function userToolsRoot(homeDir: string = os.homedir()): string {
  return path.join(homeDir, '.aitools');
}

/**
 * Directory that holds aitools.json + aitools-lock.json for the given scope.
 * Project scope → cwd; user scope → ~/.aitools.
 */
export function trackingRoot(
  scope: InstallScope,
  cwd: string,
  homeDir: string = os.homedir(),
): string {
  return scope === 'user' ? userToolsRoot(homeDir) : path.resolve(cwd);
}

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
import type { ContextState } from './types.js';
import { ensureProjectContextRoot, statePath } from './paths.js';

/** No snapshot has ever been saved or applied: any cataloged file counts as unsaved work. */
export const EMPTY_STATE: ContextState = { active: null, scope: null, files: [] };

export function readState(projectRoot: string): ContextState {
  const file = statePath(projectRoot);
  if (!fs.existsSync(file)) return { ...EMPTY_STATE, files: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ContextState;
}

export function writeState(projectRoot: string, state: ContextState): void {
  ensureProjectContextRoot(projectRoot);
  fs.writeFileSync(statePath(projectRoot), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

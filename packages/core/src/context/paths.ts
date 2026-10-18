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

/** Snapshot store directory, relative to a project root or the user tools root (`~/.aitools`). */
export const CONTEXT_DIR = '.aitools/context';
export const STASH_DIR = 'stash';
export const STATE_FILE = 'state.json';
export const SNAPSHOT_MANIFEST_FILE = 'manifest.json';

/** Stash and active state describe one working tree, so they never belong in version control. */
const PROJECT_CONTEXT_GITIGNORE = `${STASH_DIR}/\n${STATE_FILE}\n`;

export function contextRoot(base: string): string {
  return path.join(path.resolve(base), ...CONTEXT_DIR.split('/'));
}

export function snapshotDir(base: string, label: string): string {
  return path.join(contextRoot(base), label);
}

export function stashRoot(projectRoot: string): string {
  return path.join(contextRoot(projectRoot), STASH_DIR);
}

export function statePath(projectRoot: string): string {
  return path.join(contextRoot(projectRoot), STATE_FILE);
}

/** Create the project store root and its `.gitignore` on first write. */
export function ensureProjectContextRoot(projectRoot: string): string {
  const root = contextRoot(projectRoot);
  fs.mkdirSync(root, { recursive: true });
  const gitignore = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignore)) {
    fs.writeFileSync(gitignore, PROJECT_CONTEXT_GITIGNORE, 'utf8');
  }
  return root;
}

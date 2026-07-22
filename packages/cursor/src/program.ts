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
import { Command } from 'commander';
import { createLoadCommand } from './commands/load.js';
import { CURSOR_CLI_VERSION } from './version.js';

/**
 * Standalone Cursor helper program (`aitools-cursor`).
 * Also reused by `aitools cursor` so the surface stays one implementation.
 */
export function createCursorProgram(name = 'aitools-cursor'): Command {
  const program = new Command();
  program
    .name(name)
    .description(
      'Cursor Agent helpers — map multi-root .code-workspace folders into agent roots',
    )
    .version(CURSOR_CLI_VERSION);

  program.addCommand(createLoadCommand());
  return program;
}

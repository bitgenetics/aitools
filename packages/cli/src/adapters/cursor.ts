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
import type { PlatformAdapter, AdapterFileCategory } from './types.js';
import { resolveFileCategory } from './types.js';
import type { InstallScope, FileCategory } from '@bitgenetics/aitools-core';

/**
 * Cursor IDE adapter.
 *
 * Project scope paths:
 *   skill   → .cursor/skills/ (also .agents/skills/)
 *   rule    → .cursor/rules/
 *   command → .cursor/commands/
 *   agent   → .cursor/agents/
 *   hook    → .cursor/hooks.json
 *   mcp     → .cursor/mcp.json
 */
export class CursorAdapter implements PlatformAdapter {
  readonly platform = 'cursor' as const;

  private projectDirs: Record<FileCategory, string> = {
    skill:   path.join('.cursor', 'skills'),
    rule:    path.join('.cursor', 'rules'),
    command: path.join('.cursor', 'commands'),
    agent:   path.join('.cursor', 'agents'),
  };

  private userDirs(): Record<FileCategory, string> {
    const home = os.homedir();
    return {
      skill:   path.join(home, '.cursor', 'skills'),
      rule:    path.join(home, '.cursor', 'rules'),
      command: path.join(home, '.cursor', 'commands'),
      agent:   path.join(home, '.cursor', 'agents'),
    };
  }

  resolveDir(category: AdapterFileCategory, scope: InstallScope, cwd: string): string {
    const fileCategory = resolveFileCategory(category);
    if (scope === 'project') {
      return path.resolve(cwd, this.projectDirs[fileCategory]);
    }
    return this.userDirs()[fileCategory];
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.cursor', 'mcp.json');
    return path.join(os.homedir(), '.cursor', 'mcp.json');
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.cursor', 'hooks.json');
    return path.join(os.homedir(), '.cursor', 'hooks.json');
  }
}

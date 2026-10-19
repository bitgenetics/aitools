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
import type { PlatformAdapter, AdapterFileCategory, CategoryDirs } from './types.js';
import { resolveCategoryDir } from './types.js';
import type { InstallScope } from '@bitgenetics/aitools-core';

/**
 * Windsurf IDE (Cognition) adapter.
 *
 * Project scope paths:
 *   skill   → .windsurf/skills/
 *   rule    → .devin/rules/ (preferred; .windsurf/rules/ legacy)
 *   command → .windsurf/workflows/
 *   agent   → not supported (Windsurf has no agent files; resolveDir throws)
 *   hook    → .windsurf/hooks.json
 *   mcp     → .windsurf/mcp.json
 */
export class WindsurfAdapter implements PlatformAdapter {
  readonly platform = 'windsurf' as const;

  private projectDirs: CategoryDirs = {
    instructions: '.',
    skill:   path.join('.windsurf', 'skills'),
    rule:    path.join('.devin', 'rules'),
    command: path.join('.windsurf', 'workflows'),
  };

  private userDirs(): CategoryDirs {
    const home = os.homedir();
    return {
      skill:   path.join(home, '.windsurf', 'skills'),
      rule:    path.join(home, '.devin', 'rules'),
      command: path.join(home, '.windsurf', 'workflows'),
    };
  }

  resolveDir(category: AdapterFileCategory, scope: InstallScope, cwd: string): string {
    const dirs = scope === 'project' ? this.projectDirs : this.userDirs();
    return resolveCategoryDir(this.platform, dirs, category, scope, cwd);
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.windsurf', 'mcp.json');
    return path.join(os.homedir(), '.windsurf', 'mcp.json');
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.windsurf', 'hooks.json');
    return path.join(os.homedir(), '.windsurf', 'hooks.json');
  }
}

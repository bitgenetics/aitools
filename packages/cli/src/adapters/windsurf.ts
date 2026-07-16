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
 * Windsurf IDE (Cognition) adapter.
 *
 * Project scope paths:
 *   skill   → .windsurf/skills/
 *   rule    → .devin/rules/ (preferred; .windsurf/rules/ legacy)
 *   command → .windsurf/workflows/
 *   agent   → no native format (falls back to .windsurf/agents/ with warning)
 *   hook    → .windsurf/hooks.json
 *   mcp     → .windsurf/mcp.json
 */
export class WindsurfAdapter implements PlatformAdapter {
  readonly platform = 'windsurf' as const;

  private projectDirs: Record<FileCategory, string> = {
    skill:   path.join('.windsurf', 'skills'),
    rule:    path.join('.devin', 'rules'),
    command: path.join('.windsurf', 'workflows'),
    agent:   path.join('.windsurf', 'agents'),
  };

  private userDirs(): Record<FileCategory, string> {
    const home = os.homedir();
    return {
      skill:   path.join(home, '.windsurf', 'skills'),
      rule:    path.join(home, '.devin', 'rules'),
      command: path.join(home, '.windsurf', 'workflows'),
      agent:   path.join(home, '.windsurf', 'agents'),
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
    if (scope === 'project') return path.resolve(cwd, '.windsurf', 'mcp.json');
    return path.join(os.homedir(), '.windsurf', 'mcp.json');
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.windsurf', 'hooks.json');
    return path.join(os.homedir(), '.windsurf', 'hooks.json');
  }
}

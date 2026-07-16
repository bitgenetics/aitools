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
 * Universal adapter — internal fallback when no platform is configured.
 *
 * Project scope uses .agents/ convention.
 * User scope uses ~/.aitools/tools/.
 */
export class UniversalAdapter implements PlatformAdapter {
  readonly platform = 'universal' as const;

  private projectDirs: Record<FileCategory, string> = {
    skill:   path.join('.agents', 'skills'),
    rule:    path.join('.agents', 'rules'),
    command: path.join('.agents', 'commands'),
    agent:   path.join('.agents', 'agents'),
  };

  private userDirs(): Record<FileCategory, string> {
    const home = os.homedir();
    return {
      skill:   path.join(home, '.aitools', 'tools', 'skills'),
      rule:    path.join(home, '.aitools', 'tools', 'rules'),
      command: path.join(home, '.aitools', 'tools', 'commands'),
      agent:   path.join(home, '.aitools', 'tools', 'agents'),
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
    if (scope === 'project') return path.resolve(cwd, '.agents', 'mcp.json');
    return path.join(os.homedir(), '.aitools', 'mcp.json');
  }

  resolveHooksConfig(_scope: InstallScope, _cwd: string): string | null {
    return null;
  }
}

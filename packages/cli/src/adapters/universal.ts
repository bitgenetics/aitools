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
import type { PlatformAdapter } from './types.js';
import { resolveFileCategory } from './types.js';
import type { ToolCategory, InstallScope, FileCategory } from '@bitgenetics/aitools-core';

/**
 * Universal adapter ? internal fallback when no platform is configured.
 *
 * Project scope uses .agents/ convention.
 * User scope uses ~/.aitools/tools/.
 */
export class UniversalAdapter implements PlatformAdapter {
  readonly platform = 'universal' as const;

  private readonly DIRS: Record<InstallScope, Record<FileCategory, string>> = {
    project: {
      skill:   path.join('.agents', 'skills'),
      rule:    path.join('.agents', 'rules'),
      command: path.join('.agents', 'commands'),
      agent:   path.join('.agents', 'agents'),
    },
    user: {
      skill:   path.join(os.homedir(), '.aitools', 'tools', 'skills'),
      rule:    path.join(os.homedir(), '.aitools', 'tools', 'rules'),
      command: path.join(os.homedir(), '.aitools', 'tools', 'commands'),
      agent:   path.join(os.homedir(), '.aitools', 'tools', 'agents'),
    },
  };

  resolveDir(category: Exclude<ToolCategory, 'mcp-tool' | 'hook' | 'plugin'>, scope: InstallScope, cwd: string): string {
    const fileCategory = resolveFileCategory(category);
    const p = this.DIRS[scope][fileCategory];
    return scope === 'project' ? path.resolve(cwd, p) : p;
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.agents', 'mcp.json');
    return path.join(os.homedir(), '.aitools', 'mcp.json');
  }

  resolveHooksConfig(_scope: InstallScope, _cwd: string): string | null {
    return null;
  }
}

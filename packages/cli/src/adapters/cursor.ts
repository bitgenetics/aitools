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

  private readonly DIRS: Record<InstallScope, Record<FileCategory, string>> = {
    project: {
      skill:   path.join('.cursor', 'skills'),
      rule:    path.join('.cursor', 'rules'),
      command: path.join('.cursor', 'commands'),
      agent:   path.join('.cursor', 'agents'),
    },
    user: {
      skill:   path.join(os.homedir(), '.cursor', 'skills'),
      rule:    path.join(os.homedir(), '.cursor', 'rules'),
      command: path.join(os.homedir(), '.cursor', 'commands'),
      agent:   path.join(os.homedir(), '.cursor', 'agents'),
    },
  };

  resolveDir(category: Exclude<ToolCategory, 'mcp-tool' | 'hook'>, scope: InstallScope, cwd: string): string {
    const fileCategory = resolveFileCategory(category);
    const p = this.DIRS[scope][fileCategory];
    return scope === 'project' ? path.resolve(cwd, p) : p;
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

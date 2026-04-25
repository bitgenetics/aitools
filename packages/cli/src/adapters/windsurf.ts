// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import type { ToolCategory, InstallScope } from '@ai-tools/core';

/**
 * Windsurf IDE (Cognition) adapter.
 *
 * Project scope paths:
 *   skill    → .windsurf/skills/
 *   subagent → .windsurf/agents/
 *   prompt   → .windsurf/rules/   (Wave 8+: .windsurf/rules/*.md)
 *   mcp      → .windsurf/mcp.json
 *
 * User scope paths:
 *   skill    → ~/.windsurf/skills/
 *   subagent → ~/.windsurf/agents/
 *   prompt   → ~/.windsurf/rules/
 *   mcp      → ~/.windsurf/mcp.json
 */
export class WindsurfAdapter implements PlatformAdapter {
  readonly platform = 'windsurf' as const;

  private readonly DIRS: Record<InstallScope, Record<Exclude<ToolCategory, 'mcp-tool'>, string>> = {
    project: {
      skill:    path.join('.windsurf', 'skills'),
      subagent: path.join('.windsurf', 'agents'),
      prompt:   path.join('.windsurf', 'rules'),
    },
    user: {
      skill:    path.join(os.homedir(), '.windsurf', 'skills'),
      subagent: path.join(os.homedir(), '.windsurf', 'agents'),
      prompt:   path.join(os.homedir(), '.windsurf', 'rules'),
    },
  };

  resolveDir(category: Exclude<ToolCategory, 'mcp-tool'>, scope: InstallScope, cwd: string): string {
    const p = this.DIRS[scope][category];
    return scope === 'project' ? path.resolve(cwd, p) : p;
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.windsurf', 'mcp.json');
    return path.join(os.homedir(), '.windsurf', 'mcp.json');
  }
}

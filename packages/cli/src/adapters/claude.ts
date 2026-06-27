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
import type { ToolCategory, InstallScope } from '@aitools/core';

/**
 * Claude Code (Anthropic CLI) adapter.
 *
 * Project scope paths:
 *   skill    ? .claude/skills/     (Agent Skills spec — SKILL.md directories)
 *   subagent ? .claude/agents/     (custom agent .md files)
 *   prompt   ? .claude/commands/   (slash commands — legacy; skill is preferred)
 *   mcp      ? .mcp.json           (project-root MCP config)
 *
 * User scope paths:
 *   skill    ? ~/.claude/skills/
 *   subagent ? ~/.claude/agents/
 *   prompt   ? ~/.claude/commands/
 *   mcp      ? ~/.claude/mcp.json
 */
export class ClaudeAdapter implements PlatformAdapter {
  readonly platform = 'claude' as const;

  private readonly DIRS: Record<InstallScope, Record<Exclude<ToolCategory, 'mcp-tool'>, string>> = {
    project: {
      skill:    path.join('.claude', 'skills'),
      subagent: path.join('.claude', 'agents'),
      prompt:   path.join('.claude', 'commands'),
    },
    user: {
      skill:    path.join(os.homedir(), '.claude', 'skills'),
      subagent: path.join(os.homedir(), '.claude', 'agents'),
      prompt:   path.join(os.homedir(), '.claude', 'commands'),
    },
  };

  resolveDir(category: Exclude<ToolCategory, 'mcp-tool'>, scope: InstallScope, cwd: string): string {
    const p = this.DIRS[scope][category];
    return scope === 'project' ? path.resolve(cwd, p) : p;
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.mcp.json');
    return path.join(os.homedir(), '.claude', 'mcp.json');
  }
}

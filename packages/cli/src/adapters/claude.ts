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
 * Claude Code (Anthropic CLI) adapter.
 *
 * Project scope paths:
 *   skill   ? .claude/skills/
 *   rule    ? .claude/rules/
 *   command ? .claude/commands/
 *   agent   ? .claude/agents/
 *   hook    ? .claude/settings.json (merged under "hooks" key)
 *   mcp     ? .mcp.json
 */
export class ClaudeAdapter implements PlatformAdapter {
  readonly platform = 'claude' as const;

  private projectDirs: Record<FileCategory, string> = {
    skill:   path.join('.claude', 'skills'),
    rule:    path.join('.claude', 'rules'),
    command: path.join('.claude', 'commands'),
    agent:   path.join('.claude', 'agents'),
  };

  private userDirs(): Record<FileCategory, string> {
    const home = os.homedir();
    return {
      skill:   path.join(home, '.claude', 'skills'),
      rule:    path.join(home, '.claude', 'rules'),
      command: path.join(home, '.claude', 'commands'),
      agent:   path.join(home, '.claude', 'agents'),
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
    if (scope === 'project') return path.resolve(cwd, '.mcp.json');
    // Personal MCP servers live in ~/.claude.json (official Claude Code docs).
    return path.join(os.homedir(), '.claude.json');
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.claude', 'settings.json');
    return path.join(os.homedir(), '.claude', 'settings.json');
  }
}

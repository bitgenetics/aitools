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

  private readonly DIRS: Record<InstallScope, Record<FileCategory, string>> = {
    project: {
      skill:   path.join('.claude', 'skills'),
      rule:    path.join('.claude', 'rules'),
      command: path.join('.claude', 'commands'),
      agent:   path.join('.claude', 'agents'),
    },
    user: {
      skill:   path.join(os.homedir(), '.claude', 'skills'),
      rule:    path.join(os.homedir(), '.claude', 'rules'),
      command: path.join(os.homedir(), '.claude', 'commands'),
      agent:   path.join(os.homedir(), '.claude', 'agents'),
    },
  };

  resolveDir(category: AdapterFileCategory, scope: InstallScope, cwd: string): string {
    const fileCategory = resolveFileCategory(category);
    const p = this.DIRS[scope][fileCategory];
    return scope === 'project' ? path.resolve(cwd, p) : p;
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.mcp.json');
    return path.join(os.homedir(), '.claude', 'mcp.json');
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.claude', 'settings.json');
    return path.join(os.homedir(), '.claude', 'settings.json');
  }
}

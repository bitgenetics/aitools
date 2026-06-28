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
 * VS Code / GitHub Copilot adapter.
 *
 * Project scope paths:
 *   skill   ? .github/skills/ (also .agents/skills/)
 *   rule    ? .github/instructions/
 *   command ? .github/prompts/
 *   agent   ? .github/agents/
 *   hook    ? .github/hooks/hooks.json (Copilot CLI format)
 *   mcp     ? .vscode/mcp.json
 */
export class VsCodeAdapter implements PlatformAdapter {
  readonly platform = 'vscode' as const;

  private readonly DIRS: Record<InstallScope, Record<FileCategory, string>> = {
    project: {
      skill:   path.join('.github', 'skills'),
      rule:    path.join('.github', 'instructions'),
      command: path.join('.github', 'prompts'),
      agent:   path.join('.github', 'agents'),
    },
    user: {
      skill:   path.join(os.homedir(), '.copilot', 'skills'),
      rule:    path.join(os.homedir(), '.copilot', 'instructions'),
      command: path.join(os.homedir(), '.copilot', 'prompts'),
      agent:   path.join(os.homedir(), '.copilot', 'agents'),
    },
  };

  resolveDir(category: Exclude<ToolCategory, 'mcp-tool' | 'hook'>, scope: InstallScope, cwd: string): string {
    const fileCategory = resolveFileCategory(category);
    const p = this.DIRS[scope][fileCategory];
    return scope === 'project' ? path.resolve(cwd, p) : p;
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.vscode', 'mcp.json');
    return path.join(os.homedir(), '.vscode', 'mcp.json');
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.github', 'hooks', 'hooks.json');
    return path.join(os.homedir(), '.copilot', 'hooks', 'hooks.json');
  }
}

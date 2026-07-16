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
 * VS Code / GitHub Copilot adapter.
 *
 * Project scope paths:
 *   skill   → .github/skills/
 *   rule    → .github/instructions/
 *   command → .github/prompts/
 *   agent   → .github/agents/
 *   hook    → .github/hooks/hooks.json
 *   mcp     → .vscode/mcp.json
 *
 * User scope:
 *   skill/rule/agent → ~/.copilot/{skills,instructions,agents}
 *   command (prompts) → ~/.copilot/prompts (Copilot-aligned; VS Code UI may also use profile data)
 *   mcp → VS Code user profile mcp.json (MCP: Open User Configuration)
 *   hooks → ~/.copilot/hooks/hooks.json
 */
export class VsCodeAdapter implements PlatformAdapter {
  readonly platform = 'vscode' as const;

  private projectDirs: Record<FileCategory, string> = {
    skill:   path.join('.github', 'skills'),
    rule:    path.join('.github', 'instructions'),
    command: path.join('.github', 'prompts'),
    agent:   path.join('.github', 'agents'),
  };

  private userDirs(): Record<FileCategory, string> {
    const home = os.homedir();
    return {
      skill:   path.join(home, '.copilot', 'skills'),
      rule:    path.join(home, '.copilot', 'instructions'),
      command: path.join(home, '.copilot', 'prompts'),
      agent:   path.join(home, '.copilot', 'agents'),
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
    if (scope === 'project') return path.resolve(cwd, '.vscode', 'mcp.json');
    return resolveVsCodeUserMcpConfig();
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.github', 'hooks', 'hooks.json');
    return path.join(os.homedir(), '.copilot', 'hooks', 'hooks.json');
  }
}

/** Absolute path to VS Code user-profile mcp.json (MCP: Open User Configuration). */
export function resolveVsCodeUserMcpConfig(homeDir: string = os.homedir()): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'User', 'mcp.json');
  }
  if (process.platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
  }
  return path.join(homeDir, '.config', 'Code', 'User', 'mcp.json');
}

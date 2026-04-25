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
 * VS Code / GitHub Copilot adapter.
 *
 * VS Code Copilot supports the universal Agent Skills spec (.agents/) so we
 * use those paths for file-based categories. This keeps installed tools in a
 * cross-IDE location rather than a VS Code-specific subdirectory.
 *
 * Project scope paths:
 *   skill    → .agents/skills/   (Agent Skills spec — universal)
 *   subagent → .github/agents/   (VS Code custom agents — docs: https://code.visualstudio.com/docs/copilot/customization/custom-agents)
 *   prompt   → .agents/prompts/
 *   mcp      → .vscode/mcp.json  (VS Code-specific)
 *
 * User scope paths:
 *   skill    → ~/.copilot/skills/
 *   subagent → ~/.copilot/agents/
 *   prompt   → ~/.copilot/prompts/
 *   mcp      → ~/.vscode/mcp.json
 */
export class VsCodeAdapter implements PlatformAdapter {
  readonly platform = 'vscode' as const;

  private readonly DIRS: Record<InstallScope, Record<Exclude<ToolCategory, 'mcp-tool'>, string>> = {
    project: {
      skill:    path.join('.agents', 'skills'),
      subagent: path.join('.github', 'agents'),
      prompt:   path.join('.agents', 'prompts'),
    },
    user: {
      skill:    path.join(os.homedir(), '.copilot', 'skills'),
      subagent: path.join(os.homedir(), '.copilot', 'agents'),
      prompt:   path.join(os.homedir(), '.copilot', 'prompts'),
    },
  };

  resolveDir(category: Exclude<ToolCategory, 'mcp-tool'>, scope: InstallScope, cwd: string): string {
    const p = this.DIRS[scope][category];
    return scope === 'project' ? path.resolve(cwd, p) : p;
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.vscode', 'mcp.json');
    return path.join(os.homedir(), '.vscode', 'mcp.json');
  }
}

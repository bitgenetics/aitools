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
 *   subagent → .agents/agents/
 *   prompt   → .agents/prompts/
 *   mcp      → .vscode/mcp.json  (VS Code-specific)
 *
 * User scope paths:
 *   skill    → ~/.ai-tools/tools/skills/
 *   subagent → ~/.ai-tools/tools/agents/
 *   prompt   → ~/.ai-tools/tools/prompts/
 *   mcp      → ~/.vscode/mcp.json
 */
export class VsCodeAdapter implements PlatformAdapter {
  readonly platform = 'vscode' as const;

  private readonly DIRS: Record<InstallScope, Record<Exclude<ToolCategory, 'mcp-tool'>, string>> = {
    project: {
      skill:    path.join('.agents', 'skills'),
      subagent: path.join('.agents', 'agents'),
      prompt:   path.join('.agents', 'prompts'),
    },
    user: {
      skill:    path.join(os.homedir(), '.ai-tools', 'tools', 'skills'),
      subagent: path.join(os.homedir(), '.ai-tools', 'tools', 'agents'),
      prompt:   path.join(os.homedir(), '.ai-tools', 'tools', 'prompts'),
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

import os from 'node:os';
import path from 'node:path';
import type { PlatformAdapter } from './types.js';
import type { ToolCategory, InstallScope } from '@ai-tools/core';

/**
 * Claude Code (Anthropic CLI) adapter.
 *
 * Project scope paths:
 *   skill    → .claude/skills/     (Agent Skills spec — SKILL.md directories)
 *   subagent → .claude/agents/     (custom agent .md files)
 *   prompt   → .claude/commands/   (slash commands — legacy; skill is preferred)
 *   mcp      → .mcp.json           (project-root MCP config)
 *
 * User scope paths:
 *   skill    → ~/.claude/skills/
 *   subagent → ~/.claude/agents/
 *   prompt   → ~/.claude/commands/
 *   mcp      → ~/.claude/mcp.json
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

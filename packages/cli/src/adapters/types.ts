import type { ToolCategory, InstallScope, TargetPlatform } from '@ai-tools/core';

/**
 * A platform adapter translates the universal ai-tools category model into
 * the concrete file-system paths and config-file locations required by a
 * specific AI platform (VS Code, Claude Code, Cursor, Windsurf, …).
 *
 * File-based categories (skill, subagent, prompt) install files into a
 * directory. The MCP category injects a server entry into the platform's
 * mcp.json config file instead.
 */
export interface PlatformAdapter {
  readonly platform: TargetPlatform;

  /**
   * Absolute path to the directory where skill / subagent / prompt files
   * should be written for the given scope.
   */
  resolveDir(
    category: Exclude<ToolCategory, 'mcp-tool'>,
    scope: InstallScope,
    cwd: string,
  ): string;

  /**
   * Absolute path to the mcp.json config file that should receive a new
   * server entry when an mcp-tool is installed.
   */
  resolveMcpConfig(scope: InstallScope, cwd: string): string;
}

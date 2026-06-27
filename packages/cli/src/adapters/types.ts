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
import type { ToolCategory, InstallScope, TargetPlatform } from '@aitools/core';

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

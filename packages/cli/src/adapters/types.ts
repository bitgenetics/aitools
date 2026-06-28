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
import type { ToolCategory, InstallScope, TargetPlatform, FileCategory } from '@bitgenetics/aitools-core';
import { normalizeCategory } from '@bitgenetics/aitools-core';

/**
 * A platform adapter translates the universal ai-tools category model into
 * the concrete file-system paths and config-file locations required by a
 * specific AI platform (VS Code, Claude Code, Cursor, Windsurf, �).
 */
export interface PlatformAdapter {
  readonly platform: TargetPlatform;

  /**
   * Absolute path to the directory where file-based tool content should be written.
   * Does not apply to mcp-tool (use resolveMcpConfig) or hook (use resolveHooksConfig).
   */
  resolveDir(
    category: Exclude<ToolCategory, 'mcp-tool' | 'hook'>,
    scope: InstallScope,
    cwd: string,
  ): string;

  /**
   * Absolute path to the mcp.json config file for mcp-tool installs.
   */
  resolveMcpConfig(scope: InstallScope, cwd: string): string;

  /**
   * Absolute path to the hooks config file, or null when hooks are unsupported.
   * Claude hooks live under the "hooks" key in settings.json.
   */
  resolveHooksConfig(scope: InstallScope, cwd: string): string | null;
}

/** Map manifest category (including deprecated aliases) to adapter directory key. */
export function resolveFileCategory(category: Exclude<ToolCategory, 'mcp-tool' | 'hook'>): FileCategory {
  const { category: normalized } = normalizeCategory(category);
  if (normalized === 'hook' || normalized === 'mcp-tool') {
    throw new Error(`Category "${category}" is not file-based`);
  }
  return normalized;
}

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
import type { InstalledTool } from './tool.js';
import type { TargetPlatform, ToolCategory, InstallScope } from './tool.js';
import type { ReferenceLockEntry } from './reference.js';

/**
 * aitools-lock.json � exact resolved versions and file locations.
 * Analogous to package-lock.json. Should be committed to source control.
 */
export interface AiToolsLock {
  lockfileVersion: 1;
  /** Map of tool name ? lock entry. */
  tools: Record<string, LockEntry>;
}

/**
 * Single entry in the lock file.
 */
export interface LockEntry {
  /** Exact resolved version (no ranges). */
  version: string;
  /** Full URL used to download the tarball. */
  resolved: string;
  /** SHA-256 integrity hash of the downloaded tarball (base64). */
  integrity: string;
  /** Paths of every file written during installation, relative to project root (forward slashes). Legacy entries may be absolute. */
  files: string[];
  /** ISO-8601 installation timestamp. */
  installedAt: string;
  /**
   * Platform the tool was adapted for at install time.
   * Absent on entries written by older versions of ai-tools.
   */
  platform?: TargetPlatform;
  /**
   * Tool category recorded at install time.
   * Absent on entries written by older versions of ai-tools.
   */
  category?: ToolCategory;
  /**
   * Install scope (project | user).
   * Absent on entries written by older versions of ai-tools.
   */
  scope?: InstallScope;
  /**
   * MCP server keys merged into the platform mcp config by this install.
   * Used by uninstall to remove only those keys from a shared mcp.json.
   */
  mcpKeys?: string[];
  /** Relative or absolute path to the mcp config file written/updated by this install. */
  mcpConfig?: string;
  /**
   * Hook handlers this install appended, keyed by event name.
   * Used by uninstall to unmerge without wiping unrelated handlers.
   */
  hooksAdded?: Record<string, unknown[]>;
  /** Relative or absolute path to the hooks config file updated by this install. */
  hooksConfig?: string;
  /** Vendored registry reference packages owned by this install. */
  references?: Record<string, ReferenceLockEntry>;
}

/** Construct a lock entry from an InstalledTool record. */
export function toLockEntry(tool: InstalledTool, resolved: string): LockEntry {
  return {
    version: tool.version,
    resolved,
    integrity: tool.integrity,
    files: tool.files,
    installedAt: tool.installedAt,
    platform: tool.platform,
    category: tool.category,
    scope: tool.scope,
    ...(tool.mcpKeys && tool.mcpKeys.length > 0 ? { mcpKeys: tool.mcpKeys } : {}),
    ...(tool.mcpConfig ? { mcpConfig: tool.mcpConfig } : {}),
    ...(tool.hooksAdded && Object.keys(tool.hooksAdded).length > 0
      ? { hooksAdded: tool.hooksAdded }
      : {}),
    ...(tool.hooksConfig ? { hooksConfig: tool.hooksConfig } : {}),
  };
}

/** Construct an empty lock file. */
export function emptyLock(): AiToolsLock {
  return { lockfileVersion: 1, tools: {} };
}

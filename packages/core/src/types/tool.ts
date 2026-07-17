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
/**
 * Tool categories supported by the aitools registry.
 * Each category has specific install behaviour and target paths.
 *
 * Deprecated aliases accepted at parse time and normalized internally:
 * - subagent → agent
 * - prompt   → command (ambiguous; prefer explicit rule or command)
 */
export type ToolCategory =
  | 'skill'
  | 'rule'
  | 'command'
  | 'agent'
  | 'hook'
  | 'mcp-tool'
  | 'plugin'
  | 'reference'
  | 'subagent'
  | 'prompt';

/**
 * Where the tool is installed relative to the user's environment.
 * - project: installed inside the current project (tracked in source control)
 * - user:    installed for the current OS user (IDE-level, all projects)
 */
export type InstallScope = 'project' | 'user';

/**
 * Supported target platforms.
 * The installer adapts file paths and config formats to the selected platform.
 * - universal: .agents/ convention (default, tool-agnostic)
 * - vscode:    VS Code / GitHub Copilot
 * - claude:    Claude Code (Anthropic CLI)
 * - cursor:    Cursor IDE
 * - windsurf:  Windsurf IDE (Cognition)
 */
export type TargetPlatform = 'universal' | 'vscode' | 'claude' | 'cursor' | 'windsurf';

import type { ReferenceBindingInput } from './reference.js';

/**
 * A single file entry inside a tool package.
 * `src` is the path inside the published package archive.
 * `dest` is the install destination path.
 * - For skill/rule/command/agent (non-plugin): relative to the platform category install dir.
 * - For plugins with `placementMode: "strict"` (default): project-relative path honored 1:1.
 * - For plugins with `placementMode: "transform"`: remapped via plugin explode (e.g. assets → synthetic skill).
 */
export type PlacementMode = 'strict' | 'transform';

export interface ToolFile {
  src: string;
  dest: string;
  /**
   * How `dest` is applied at install time.
   * - strict (default when omitted): honor `dest` as written
   * - transform: allow placement remapping (plugin assets/scripts → synthetic skill package, destExtension, …)
   */
  placementMode?: PlacementMode;
  /** When true the file is processed as a Handlebars template before writing. */
  template?: boolean;
  /** When set, this file is only installed for the specified platform. Omit to install on all platforms. */
  platform?: TargetPlatform;
}

/**
 * MCP server registration entry.
 * Used by mcp-tool packages to describe the server that should be registered
 * in the platform's mcp.json config file on install.
 */
export interface McpServerConfig {
  /** Shell command or path to the server executable. Required for stdio servers; omit when using url for HTTP servers. */
  command?: string;
  /** Arguments to pass to the command. */
  args?: string[];
  /** Environment variables for the server process. */
  env?: Record<string, string>;
  /** For remote HTTP MCP servers. When set, `command` is ignored. */
  url?: string;
  /** Transport type. Defaults to 'stdio' for local servers. */
  type?: 'stdio' | 'http';
}

/**
 * The canonical manifest for a publishable AITools package.
 * This is the publish subset stored in the registry as aitools.json
 * and written into installed package directories.
 */
export interface ToolManifest {
  /** Scoped or unscoped name, e.g. "@company/my-skill" or "my-skill". */
  name: string;
  /** Semver version string. */
  version: string;
  description: string;
  category: ToolCategory;
  /**
   * Platform the tool was originally authored for.
   * When set and different from the active install platform, content is transformed.
   */
  nativeFor?: TargetPlatform;
  /** Files included in this package. Required for non-mcp-tool categories. */
  files: ToolFile[];
  /**
   * MCP server registration descriptor.
   * Required when category is "mcp-tool"; ignored for other categories.
   */
  mcpServer?: McpServerConfig;
  keywords?: string[];
  author?: string;
  repository?: string;
  /** Other AITools packages this tool depends on. */
  dependencies?: Record<string, string>;
  /**
   * Registry reference packages (`category: "reference"`) to vendor at install time.
   */
  references?: Record<string, ReferenceBindingInput>;
  /** Free-form metadata used for smart-find / AI discovery. */
  tags?: string[];
  /** When set, limits install to these platforms. Omit to support all platforms. */
  platforms?: TargetPlatform[];
  /**
   * When true, this tool is hidden from unauthenticated reads when the registry
   * is running with REGISTRY_ACCESS=public.
   */
  private?: boolean;
}

/**
 * Record of a tool that has been installed into a scope.
 * Persisted in aitools-lock.json.
 */
export interface InstalledTool {
  name: string;
  version: string;
  category: ToolCategory;
  scope: InstallScope;
  /** Platform the tool was adapted for (e.g. 'vscode', 'cursor'). */
  platform: TargetPlatform;
  /** ISO-8601 timestamp of when this version was installed. */
  installedAt: string;
  /** Absolute paths of every file written during installation. */
  files: string[];
  /** Registry base URL the package was fetched from. */
  registry: string;
  /** SHA-256 integrity hash of the downloaded tarball. */
  integrity: string;
  /** MCP server keys merged by this install (plugins / MCP tools). */
  mcpKeys?: string[];
  /** Path to the mcp config file updated by this install. */
  mcpConfig?: string;
  /** Hook handlers appended by this install, keyed by event name. */
  hooksAdded?: Record<string, unknown[]>;
  /** Path to the hooks config file updated by this install. */
  hooksConfig?: string;
  /**
   * How the package was installed.
   * - absent: explode / standard file install
   * - cursor-plugin-local: opaque tree under ~/.cursor/plugins/local/
   * - plugin-bundle: author-layout roots under project cwd (skills/, rules/, …)
   */
  installMethod?: 'cursor-plugin-local' | 'plugin-bundle';
}

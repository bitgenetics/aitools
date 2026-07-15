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
import type { InstallScope, TargetPlatform } from './tool.js';
import type { ReferenceBindingInput } from './reference.js';

/** Shared fields for all registry types. */
interface RegistryConfigBase {
  /** Human-readable name, used to reference this registry from the CLI. */
  name: string;
  /** Registry endpoint URL (HTTP base URL or git remote URL). */
  url: string;
  /** Lower numbers are queried first. Defaults to 100. */
  priority?: number;
}

/**
 * HTTP Fastify registry endpoint.
 * When `type` is omitted in config files it is treated as HTTP for backward compatibility.
 */
export interface HttpRegistryConfig extends RegistryConfigBase {
  type?: 'http';
  auth?: RegistryAuth;
}

/**
 * Git-backed registry � tools are stored in a cloned repo under `path`.
 * Authentication is delegated to the system git credential helper.
 */
export interface GitRegistryConfig extends RegistryConfigBase {
  type: 'git';
  /** Branch used for install, search, and read operations. Defaults to `main`. */
  readBranch?: string;
  /** Branch used for publish operations. Defaults to `readBranch`. */
  publishBranch?: string;
  /** Directory inside the repo where tools are stored. Defaults to `registry/`. */
  path?: string;
}

/** Configuration for a single registry endpoint. */
export type RegistryConfig = HttpRegistryConfig | GitRegistryConfig;

export function isGitRegistryConfig(config: RegistryConfig): config is GitRegistryConfig {
  return config.type === 'git';
}

export interface RegistryAuth {
  type: 'bearer' | 'basic';
  token?: string;
  username?: string;
  password?: string;
}

/**
 * aitools.config.json � the cascading configuration file.
 * Located at project root, user home, or system level.
 * Lower-level files override higher-level ones (project > user > system).
 */
export interface AiToolsConfig {
  /** Ordered list of registry endpoints. */
  registries?: RegistryConfig[];
  /** Default install scope when --scope flag is omitted. */
  defaultScope?: InstallScope;
  /**
   * Target platform for installation. Controls which directory structure and
   * config file format the installer uses.
   * Defaults to "universal" (.agents/ convention).
   */
  platform?: TargetPlatform;
  /**
   * Override where tool files are written for specific category+scope combos.
   * Keys use the format "<scope>.<category>", e.g. "project.skill".
   * Values are absolute or home-relative (~/) paths.
   * Example: { "project.skill": "~/.agents/skills" }
   */
  installPaths?: Partial<Record<string, string>>;
  /**
   * Per-package overrides for reference vendoring (`into`, `layout`).
   * Keys are parent package names; values map reference name -> binding.
   */
  referenceBindings?: Record<string, Record<string, ReferenceBindingInput>>;
}

/**
 * aitools.json — unified per-project manifest (npm-style).
 * Consumer deps + optional publish fields in one file.
 */
export interface AiToolsManifest {
  /** Optional project or package name. */
  name?: string;
  /** Registry packages required for this project, name -> semver range. */
  dependencies?: Record<string, string>;
  /** Dev-only registry packages (aitools install --dev). */
  devDependencies?: Record<string, string>;
  /** Registry overrides specific to this project. */
  registries?: RegistryConfig[];
  // Publish fields (optional until publishing)
  version?: string;
  description?: string;
  category?: import('./tool.js').ToolCategory;
  nativeFor?: import('./tool.js').TargetPlatform;
  files?: import('./tool.js').ToolFile[];
  mcpServer?: import('./tool.js').McpServerConfig;
  keywords?: string[];
  author?: string;
  repository?: string;
  references?: Record<string, ReferenceBindingInput>;
  tags?: string[];
  platforms?: import('./tool.js').TargetPlatform[];
  private?: boolean;
}

/** Alias for unified manifest type. */
export type AitoolsJson = AiToolsManifest;

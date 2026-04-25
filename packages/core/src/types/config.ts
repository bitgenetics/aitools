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
import type { InstallScope, TargetPlatform } from './tool.js';

/**
 * Configuration for a single registry endpoint.
 * Registries are queried in priority order (lowest number = highest priority).
 */
export interface RegistryConfig {
  /** Human-readable name, used to reference this registry from the CLI. */
  name: string;
  /** Base URL of the registry server. */
  url: string;
  /** Lower numbers are queried first. Defaults to 100. */
  priority?: number;
  auth?: RegistryAuth;
}

export interface RegistryAuth {
  type: 'bearer' | 'basic';
  token?: string;
  username?: string;
  password?: string;
}

/**
 * ai-tools.config.json — the cascading configuration file.
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
}

/**
 * ai-tools.json — the per-project tool dependency manifest.
 * Analogous to package.json for npm.
 */
export interface AiToolsManifest {
  /** Optional project name. */
  name?: string;
  /** Tools required for this project, name -> semver range. */
  tools?: Record<string, string>;
  /** Dev-only tools (not installed in CI unless --include-dev). */
  devTools?: Record<string, string>;
  /** Registry overrides specific to this project. */
  registries?: RegistryConfig[];
}

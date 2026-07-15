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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigCascade, CONFIG_FILENAME, resolvePluginInstallDir } from '@bitgenetics/aitools-core';
import type { AiToolsConfig, InstallScope, TargetPlatform, ToolCategory } from '@bitgenetics/aitools-core';
import { getAdapter } from '../adapters/index.js';
import type { PlatformAdapter } from '../adapters/index.js';
import type { AdapterFileCategory } from '../adapters/types.js';

// -- Platform auto-detection --------------------------------------------------

/**
 * Detect the current platform from environment variables and filesystem
 * signals. Used as a fallback when no platform is set in any config file.
 *
 * Priority:
 *   1. VSCODE_PID / TERM_PROGRAM=vscode -> vscode
 *   2. CURSOR_TRACE_ID                  -> cursor
 *   3. .vscode/ directory in cwd        -> vscode
 *   4. .cursor/ directory in cwd        -> cursor
 */
export function detectPlatformFromEnv(cwd: string): TargetPlatform | undefined {
  if (process.env['VSCODE_PID'] || process.env['TERM_PROGRAM'] === 'vscode') {
    return 'vscode';
  }
  if (process.env['CURSOR_TRACE_ID']) {
    return 'cursor';
  }
  if (fs.existsSync(path.join(cwd, '.vscode'))) {
    return 'vscode';
  }
  if (fs.existsSync(path.join(cwd, '.cursor'))) {
    return 'cursor';
  }
  return undefined;
}

export class ConfigManager {
  private config: AiToolsConfig;
  private cwd: string;
  private adapter: PlatformAdapter;
  /**
   * Non-undefined when the platform was inferred from environment/filesystem
   * rather than an explicit config entry. The install command uses this to
   * suggest pinning the platform with `aitools config set platform <p>`.
   */
  readonly detectedPlatform: TargetPlatform | undefined;

  constructor(
    cwd: string = process.cwd(),
    options: { platform?: TargetPlatform } = {},
  ) {
    this.cwd = cwd;
    this.config = ConfigCascade.load(cwd);
    if (options.platform) {
      this.detectedPlatform = undefined;
      this.config = { ...this.config, platform: options.platform };
    } else if (!this.config.platform) {
      this.detectedPlatform = detectPlatformFromEnv(cwd);
      if (this.detectedPlatform) {
        this.config = { ...this.config, platform: this.detectedPlatform };
      }
    } else {
      this.detectedPlatform = undefined;
    }
    this.adapter = getAdapter(this.config.platform);
  }

  get(): AiToolsConfig {
    return this.config;
  }

  getDefaultScope(): InstallScope {
    return this.config.defaultScope ?? 'project';
  }

  getPlatform(): TargetPlatform {
    return this.config.platform ?? 'universal';
  }

  getAdapter(): PlatformAdapter {
    return this.adapter;
  }

  /**
   * Resolve the absolute install directory for a file-based tool category.
   * Checks installPaths overrides in config before delegating to the adapter.
   */
  resolveInstallPath(
    category: AdapterFileCategory,
    scope: InstallScope,
  ): string {
    const overrideKey = `${scope}.${category}`;
    const override = this.config.installPaths?.[overrideKey];
    if (override) {
      return this.expandHome(override);
    }
    return this.adapter.resolveDir(category, scope, this.cwd);
  }

  /**
   * Resolve the install directory for a plugin package (platform-agnostic aitools paths).
   */
  resolvePluginInstallPath(scope: InstallScope, packageName: string): string {
    const override = this.config.installPaths?.[`${scope}.plugin`];
    const overrideBase = override ? this.expandHome(override) : undefined;
    return resolvePluginInstallDir(scope, this.cwd, packageName, overrideBase);
  }

  /**
   * Resolve the mcp.json config file path for the current platform + scope.
   */
  resolveMcpConfig(scope: InstallScope): string {
    const override = this.config.installPaths?.[`${scope}.mcp-tool`];
    if (override) {
      return this.expandHome(override);
    }
    return this.adapter.resolveMcpConfig(scope, this.cwd);
  }

  /**
   * Resolve the hooks config file path for the current platform + scope.
   * Returns null when the platform does not support hooks (universal).
   */
  resolveHooksConfig(scope: InstallScope): string | null {
    const override = this.config.installPaths?.[`${scope}.hook`];
    if (override) {
      return this.expandHome(override);
    }
    return this.adapter.resolveHooksConfig(scope, this.cwd);
  }

  /** Expand leading ~/ to the user home directory. */
  private expandHome(p: string): string {
    if (p.startsWith('~/') || p === '~') {
      return path.join(os.homedir(), p.slice(2));
    }
    return p;
  }

  /**
   * Return registries sorted by priority (lowest number first).
   */
  getRegistries() {
    const registries = this.config.registries ?? [];
    return [...registries].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  /** Read user-level config only (not merged with project). */
  readUserConfig(): AiToolsConfig {
    return this.readConfigFile(path.join(os.homedir(), CONFIG_FILENAME));
  }

  /** Read project-level config only for the current working directory. */
  readProjectConfig(): AiToolsConfig {
    return this.readConfigFile(path.join(this.cwd, CONFIG_FILENAME));
  }

  /** Write a project-level aitools.config.json. */
  writeProjectConfig(patch: Partial<AiToolsConfig>): void {
    this.writeConfigFile(path.join(this.cwd, CONFIG_FILENAME), patch);
  }

  /** Write a user-level aitools.config.json in the home directory. */
  writeUserConfig(patch: Partial<AiToolsConfig>): void {
    this.writeConfigFile(path.join(os.homedir(), CONFIG_FILENAME), patch);
  }

  private readConfigFile(filePath: string): AiToolsConfig {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AiToolsConfig;
  }

  private writeConfigFile(filePath: string, patch: Partial<AiToolsConfig>): void {
    let existing: AiToolsConfig = {};
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AiToolsConfig;
    }
    const merged = { ...existing, ...patch };
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  }
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigCascade } from '@ai-tools/core';
import type { AiToolsConfig, InstallScope, TargetPlatform, ToolCategory } from '@ai-tools/core';
import { getAdapter } from '../adapters/index.js';
import type { PlatformAdapter } from '../adapters/index.js';

export class ConfigManager {
  private config: AiToolsConfig;
  private cwd: string;
  private adapter: PlatformAdapter;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.config = ConfigCascade.load(cwd);
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
  resolveInstallPath(category: Exclude<ToolCategory, 'mcp-tool'>, scope: InstallScope): string {
    const overrideKey = `${scope}.${category}`;
    const override = this.config.installPaths?.[overrideKey];
    if (override) {
      return this.expandHome(override);
    }
    return this.adapter.resolveDir(category, scope, this.cwd);
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

  /** Write a project-level ai-tools.config.json. */
  writeProjectConfig(patch: Partial<AiToolsConfig>): void {
    this.writeConfigFile(path.join(this.cwd, 'ai-tools.config.json'), patch);
  }

  /** Write a user-level ai-tools.config.json in the home directory. */
  writeUserConfig(patch: Partial<AiToolsConfig>): void {
    this.writeConfigFile(path.join(os.homedir(), 'ai-tools.config.json'), patch);
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

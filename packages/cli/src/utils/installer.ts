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
import fs from 'node:fs';
import path from 'node:path';
import type { ToolManifest, InstalledTool, InstallScope, AiToolsLock, ToolFile, TargetPlatform } from '@ai-tools/core';
import {
  readLockFile,
  writeLockFile,
  upsertLockEntry,
  removeLockEntry,
  toLockEntry,
} from '@ai-tools/core';
import type { ConfigManager } from './config-manager.js';
import type { RegistryClient } from './registry-client.js';
import { CacheManager } from './cache-manager.js';

/**
 * Handles the file-system mechanics of installing and removing tools.
 *
 * Install flow for file-based tools (skill / subagent / prompt):
 *   1. Check CacheManager — if the tarball has already been extracted, skip download.
 *   2. On cache miss: download from registry → store to cache (~/.ai-tools/cache/).
 *   3. Copy files from the cache's .agents/ directory to the platform-specific
 *      destination resolved by ConfigManager / PlatformAdapter.
 *
 * MCP tools are not file-based; their server descriptor is injected into the
 * platform's mcp.json config file instead.
 */
export class Installer {
  private readonly cache: CacheManager;

  constructor(
    private readonly configManager: ConfigManager,
    private readonly cwd: string = process.cwd(),
    cache?: CacheManager,
  ) {
    this.cache = cache ?? new CacheManager();
  }

  /**
   * Install a tool. Downloads from the registry (or uses cache) then writes
   * files to the platform destination and records the result in the lock file.
   */
  async install(
    client: RegistryClient,
    manifest: ToolManifest,
    scope: InstallScope,
  ): Promise<InstalledTool> {
    if (manifest.category === 'mcp-tool') {
      return this.installMcp(manifest, scope, client.config.url);
    }
    return this.installFiles(client, manifest, scope);
  }

  // ── File-based install (skill / subagent / prompt) ───────────────────────

  private async installFiles(
    client: RegistryClient,
    manifest: ToolManifest,
    scope: InstallScope,
  ): Promise<InstalledTool> {
    // Reject install when the manifest restricts supported platforms and the active platform is not listed.
    if (manifest.platforms && manifest.platforms.length > 0) {
      const activePlatform = this.configManager.getPlatform();
      if (!manifest.platforms.includes(activePlatform) && !manifest.platforms.includes('universal')) {
        throw new Error(
          `"${manifest.name}" only supports platforms: ${manifest.platforms.join(', ')}.\n` +
          `Your configured platform is "${activePlatform}".\n` +
          'Run: ai-tools config set platform <platform>  to change it.',
        );
      }
    }

    // Resolve cache entry — download only on miss.
    let agentsDir: string;
    let integrity: string;

    if (this.cache.has(manifest.name, manifest.version)) {
      agentsDir = this.cache.agentsDir(manifest.name, manifest.version);
      integrity = this.cache.getMetadata(manifest.name, manifest.version).integrity;
    } else {
      const { data, integrity: serverIntegrity } = await client.download(manifest.name, manifest.version);
      const entry = this.cache.store(manifest.name, manifest.version, data, manifest, serverIntegrity);
      agentsDir = entry.agentsDir;
      integrity = entry.integrity;
    }

    // Copy from cache to platform destination.
    const category = manifest.category as Exclude<typeof manifest.category, 'mcp-tool'>;
    const installBase = this.configManager.resolveInstallPath(category, scope);
    fs.mkdirSync(installBase, { recursive: true });

    const activePlatform = this.configManager.getPlatform();
    const filesToInstall = selectFilesForPlatform(manifest.files, activePlatform);

    // Strip the installBase-relative prefix from dest in case the manifest
    // uses full project-relative paths (e.g. ".agents/skills/foo.md") instead
    // of paths relative to the install base (e.g. "foo.md").
    const relInstallBase = path.relative(this.cwd, installBase).replace(/\\/g, '/');

    const writtenFiles: string[] = [];
    for (const file of filesToInstall) {
      const srcPath = path.join(agentsDir, file.src);
      const normalizedDest = file.dest.replace(/\\/g, '/');
      const relDest =
        relInstallBase && normalizedDest.startsWith(relInstallBase + '/')
          ? normalizedDest.slice(relInstallBase.length + 1)
          : normalizedDest;
      const destPath = path.resolve(installBase, relDest);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      // Store as portable relative path (forward slashes) for lock file
      writtenFiles.push(path.relative(this.cwd, destPath).replace(/\\/g, '/'));
    }

    const installedTool: InstalledTool = {
      name: manifest.name,
      version: manifest.version,
      category: manifest.category,
      scope,
      platform: activePlatform,
      installedAt: new Date().toISOString(),
      files: writtenFiles,
      registry: client.config.url,
      integrity,
    };

    const lock = readLockFile(this.cwd);

    // Remove files from the previous install that the new install did not
    // overwrite. This handles version updates where files are renamed or
    // removed, and platform switches where the old adapted paths differ.
    const previousEntry = lock.tools[manifest.name];
    if (previousEntry) {
      const newFileSet = new Set(writtenFiles);
      for (const oldFile of previousEntry.files) {
        // Resolve relative paths from lock file (or absolute for legacy entries)
        const absOldFile = path.isAbsolute(oldFile)
          ? oldFile
          : path.resolve(this.cwd, oldFile);
        const relOldFile = path.relative(this.cwd, absOldFile).replace(/\\/g, '/');
        if (!newFileSet.has(relOldFile) && fs.existsSync(absOldFile)) {
          fs.rmSync(absOldFile);
          cleanEmptyDirs(path.dirname(absOldFile), this.cwd);
        }
      }
    }

    const updated = upsertLockEntry(lock, manifest.name, toLockEntry(installedTool, client.config.url));
    writeLockFile(this.cwd, updated);
    return installedTool;
  }

  // ── MCP install (config-file injection) ──────────────────────────────────

  private installMcp(
    manifest: ToolManifest,
    scope: InstallScope,
    registryUrl: string,
  ): InstalledTool {
    if (!manifest.mcpServer) {
      throw new Error(
        `mcp-tool "${manifest.name}" has no mcpServer descriptor in its manifest.`,
      );
    }

    const configPath = this.configManager.resolveMcpConfig(scope);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });

    // Read existing mcp.json (or start fresh).
    let mcpJson: McpJson = { servers: {} };
    if (fs.existsSync(configPath)) {
      try {
        mcpJson = JSON.parse(fs.readFileSync(configPath, 'utf8')) as McpJson;
        mcpJson.servers ??= {};
      } catch {
        throw new Error(
          `Failed to parse existing mcp.json at ${configPath}. ` +
            'Please fix or remove the file and try again.',
        );
      }
    }

    // Use the unscoped package name as the server key.
    const serverKey = manifest.name.replace(/^@[^/]+\//, '');
    mcpJson.servers[serverKey] = manifest.mcpServer.url
      ? { type: 'http', url: manifest.mcpServer.url, ...envEntry(manifest.mcpServer.env) }
      : {
          type: manifest.mcpServer.type ?? 'stdio',
          command: manifest.mcpServer.command,
          ...(manifest.mcpServer.args ? { args: manifest.mcpServer.args } : {}),
          ...envEntry(manifest.mcpServer.env),
        };

    fs.writeFileSync(configPath, JSON.stringify(mcpJson, null, 2) + '\n', 'utf8');

    const installedTool: InstalledTool = {
      name: manifest.name,
      version: manifest.version,
      category: 'mcp-tool',
      scope,
      platform: this.configManager.getPlatform(),
      installedAt: new Date().toISOString(),
      files: [path.relative(this.cwd, configPath).replace(/\\/g, '/')],
      registry: registryUrl,
      integrity: 'mcp-config',
    };

    const lock = readLockFile(this.cwd);
    const updated = upsertLockEntry(lock, manifest.name, toLockEntry(installedTool, registryUrl));
    writeLockFile(this.cwd, updated);
    return installedTool;
  }

  // ── Uninstall ─────────────────────────────────────────────────────────────

  /**
   * Remove all files for a named tool and update the lock file.
   * For MCP tools, removes the server entry from the platform mcp.json.
   * Returns the list of removed/modified file paths.
   *
   * Note: the cache entry is intentionally preserved so reinstalls are fast.
   */
  uninstall(name: string): string[] {
    const lock = readLockFile(this.cwd);
    const entry = lock.tools[name];
    if (!entry) {
      throw new Error(`Tool "${name}" is not installed in this project.`);
    }

    const removed: string[] = [];

    // Detect MCP installs: prefer the recorded category, fall back to the
    // legacy integrity sentinel for entries written by older versions.
    const isMcpEntry = entry.category === 'mcp-tool' ||
      (entry.category === undefined && entry.integrity === 'mcp-config' && entry.files.length === 1);
    if (isMcpEntry) {
      const rawPath = entry.files[0]!;
      const configPath = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(this.cwd, rawPath);
      removeMcpEntry(configPath, name);
      removed.push(configPath);
    } else {
      for (const rawFile of entry.files) {
        const filePath = path.isAbsolute(rawFile)
          ? rawFile
          : path.resolve(this.cwd, rawFile);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath);
          removed.push(filePath);
          cleanEmptyDirs(path.dirname(filePath), this.cwd);
        }
      }
    }

    const updated = removeLockEntry(lock, name);
    writeLockFile(this.cwd, updated);
    return removed;
  }

  getLock(): AiToolsLock {
    return readLockFile(this.cwd);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Filter manifest files for the active platform.
 * Platform-specific entries override unscoped ones with the same dest path.
 * Files scoped to a different platform are excluded.
 */
function selectFilesForPlatform(files: ToolFile[], activePlatform: TargetPlatform): ToolFile[] {
  const byDest = new Map<string, ToolFile>();
  for (const file of files) {
    if (!file.platform || file.platform === 'universal') {
      if (!byDest.has(file.dest)) byDest.set(file.dest, file);
    } else if (file.platform === activePlatform) {
      byDest.set(file.dest, file); // platform-specific wins
    }
  }
  return Array.from(byDest.values());
}

interface McpJson {
  servers: Record<string, unknown>;
}

function envEntry(env?: Record<string, string>) {
  return env && Object.keys(env).length > 0 ? { env } : {};
}

function removeMcpEntry(configPath: string, toolName: string): void {
  if (!fs.existsSync(configPath)) return;
  const mcpJson = JSON.parse(fs.readFileSync(configPath, 'utf8')) as McpJson;
  const serverKey = toolName.replace(/^@[^/]+\//, '');
  delete mcpJson.servers[serverKey];
  fs.writeFileSync(configPath, JSON.stringify(mcpJson, null, 2) + '\n', 'utf8');
}

function cleanEmptyDirs(dir: string, stopAt: string): void {
  // Only clean directories that are descendants of stopAt to avoid removing
  // unrelated directories (e.g. ~/.ai-tools/ when stopAt is the project cwd).
  const normalizedStop = path.normalize(stopAt);
  const normalizedDir = path.normalize(dir);
  if (!normalizedDir.startsWith(normalizedStop + path.sep)) return;
  if (normalizedDir === normalizedStop || normalizedDir === path.normalize(path.dirname(dir))) return;
  try {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) {
      fs.rmdirSync(dir);
      cleanEmptyDirs(path.dirname(dir), stopAt);
    }
  } catch {
    // Ignore — directory may already be gone
  }
}


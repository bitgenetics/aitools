import fs from 'node:fs';
import path from 'node:path';
import type { ToolManifest, InstalledTool, InstallScope, AiToolsLock } from '@ai-tools/core';
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
    // Resolve cache entry — download only on miss.
    let agentsDir: string;
    let integrity: string;

    if (this.cache.has(manifest.name, manifest.version)) {
      agentsDir = this.cache.agentsDir(manifest.name, manifest.version);
      integrity = this.cache.getMetadata(manifest.name, manifest.version).integrity;
    } else {
      const tarball = await client.download(manifest.name, manifest.version);
      const entry = this.cache.store(manifest.name, manifest.version, tarball, manifest);
      agentsDir = entry.agentsDir;
      integrity = entry.integrity;
    }

    // Copy from cache to platform destination.
    const category = manifest.category as Exclude<typeof manifest.category, 'mcp-tool'>;
    const installBase = this.configManager.resolveInstallPath(category, scope);
    fs.mkdirSync(installBase, { recursive: true });

    const writtenFiles: string[] = [];
    for (const file of manifest.files) {
      const srcPath = path.join(agentsDir, file.dest);
      const destPath = path.resolve(installBase, file.dest);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      writtenFiles.push(destPath);
    }

    const installedTool: InstalledTool = {
      name: manifest.name,
      version: manifest.version,
      category: manifest.category,
      scope,
      installedAt: new Date().toISOString(),
      files: writtenFiles,
      registry: client.config.url,
      integrity,
    };

    const lock = readLockFile(this.cwd);
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
      mcpJson = JSON.parse(fs.readFileSync(configPath, 'utf8')) as McpJson;
      mcpJson.servers ??= {};
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
      installedAt: new Date().toISOString(),
      files: [configPath],
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

    // Detect MCP installs by the sentinel integrity value.
    if (entry.integrity === 'mcp-config' && entry.files.length === 1) {
      const configPath = entry.files[0]!;
      removeMcpEntry(configPath, name);
      removed.push(configPath);
    } else {
      for (const filePath of entry.files) {
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
  if (dir === stopAt || dir === path.dirname(dir)) return;
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

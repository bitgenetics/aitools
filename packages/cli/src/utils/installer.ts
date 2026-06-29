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
import path from 'node:path';
import type { ToolManifest, InstalledTool, InstallScope, AiToolsLock, ToolFile, TargetPlatform } from '@bitgenetics/aitools-core';
import {
  readLockFile,
  writeLockFile,
  upsertLockEntry,
  removeLockEntry,
  toLockEntry,
  normalizeCategory,
  MANIFEST_FILENAME,
} from '@bitgenetics/aitools-core';
import type { ConfigManager } from './config-manager.js';
import type { RegistryClient } from './registry-client.js';
import { CacheManager } from './cache-manager.js';
import { transform, applyDestExtension, mergeHookConfigs } from '../transformers/index.js';
import type { TransformResult } from '../transformers/index.js';

export interface InstallFileResult {
  dest: string;
  transform?: TransformResult;
  skipped?: boolean;
}

export interface InstallResult extends InstalledTool {
  fileResults: InstallFileResult[];
}

/**
 * Handles the file-system mechanics of installing and removing tools.
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

  async install(
    client: RegistryClient,
    manifest: ToolManifest,
    scope: InstallScope,
  ): Promise<InstallResult> {
    const { category: normalized, warning: categoryWarning } = normalizeCategory(manifest.category);
    if (categoryWarning) {
      process.stderr.write(`[aitools] ${categoryWarning}\n`);
    }

    if (normalized === 'mcp-tool') {
      const installed = this.installMcp(manifest, scope, client.config.url);
      return { ...installed, fileResults: [] };
    }

    if (normalized === 'hook') {
      return this.installHooks(client, manifest, scope);
    }

    const installed = await this.installFiles(client, { ...manifest, category: normalized }, scope);
    return installed;
  }

  private async installHooks(
    client: RegistryClient,
    manifest: ToolManifest,
    scope: InstallScope,
  ): Promise<InstallResult> {
    const hooksConfigPath = this.configManager.resolveHooksConfig(scope);
    if (!hooksConfigPath) {
      throw new Error(
        `Hooks are not supported on platform "${this.configManager.getPlatform()}". ` +
          'Set platform to cursor, vscode, claude, or windsurf.',
      );
    }

    const activePlatform = this.configManager.getPlatform();
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

    const filesToInstall = selectFilesForPlatform(manifest.files, activePlatform);
    const fileResults: InstallFileResult[] = [];
    const writtenFiles: string[] = [];
    const sourcePlatform = manifest.nativeFor ?? 'universal';

    fs.mkdirSync(path.dirname(hooksConfigPath), { recursive: true });
    let existingContent: string | null = null;
    if (fs.existsSync(hooksConfigPath)) {
      existingContent = fs.readFileSync(hooksConfigPath, 'utf8');
    }

    let mergedContent = existingContent;

    for (const file of filesToInstall) {
      const srcPath = path.join(agentsDir, file.src);
      const rawContent = fs.readFileSync(srcPath, 'utf8');
      const relDest = path.relative(this.cwd, hooksConfigPath).replace(/\\/g, '/');

      let result: TransformResult;
      if (sourcePlatform !== activePlatform && sourcePlatform !== 'universal') {
        result = transform(rawContent, 'hook', sourcePlatform, activePlatform, { destPath: relDest });
        emitTransformMessages(relDest, result);
        if (result.recommendNativePath) {
          process.stderr.write(`[aitools] Advisory: ${result.recommendNativePath}\n`);
          fileResults.push({ dest: relDest, transform: result, skipped: true });
          continue;
        }
        if (result.confidence === 'unsupported' && !result.content.trim()) {
          fileResults.push({ dest: relDest, transform: result, skipped: true });
          continue;
        }
        mergedContent = mergeHookConfigs(mergedContent, result.content, activePlatform);
      } else {
        mergedContent = mergeHookConfigs(mergedContent, rawContent, activePlatform);
        result = { content: rawContent, confidence: 'native', warnings: [] };
      }

      fileResults.push({ dest: relDest, transform: result });
    }

    if (mergedContent !== existingContent) {
      fs.writeFileSync(hooksConfigPath, mergedContent!, 'utf8');
      writtenFiles.push(path.relative(this.cwd, hooksConfigPath).replace(/\\/g, '/'));
    }

    const installedTool: InstalledTool = {
      name: manifest.name,
      version: manifest.version,
      category: 'hook',
      scope,
      platform: activePlatform,
      installedAt: new Date().toISOString(),
      files: writtenFiles,
      registry: client.config.url,
      integrity,
    };

    const lock = readLockFile(this.cwd);
    const updated = upsertLockEntry(lock, manifest.name, toLockEntry(installedTool, client.config.url));
    writeLockFile(this.cwd, updated);
    return { ...installedTool, fileResults };
  }

  private async installFiles(
    client: RegistryClient,
    manifest: ToolManifest,
    scope: InstallScope,
  ): Promise<InstallResult> {
    if (manifest.platforms && manifest.platforms.length > 0) {
      const activePlatform = this.configManager.getPlatform();
      if (!manifest.platforms.includes(activePlatform) && !manifest.platforms.includes('universal')) {
        throw new Error(
          `"${manifest.name}" only supports platforms: ${manifest.platforms.join(', ')}.\n` +
          `Your configured platform is "${activePlatform}".\n` +
          'Run: aitools config set platform <platform>  to change it.',
        );
      }
    }

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

    const category = manifest.category as Exclude<typeof manifest.category, 'mcp-tool' | 'hook'>;
    const installBase = this.configManager.resolveInstallPath(category, scope);
    fs.mkdirSync(installBase, { recursive: true });

    const activePlatform = this.configManager.getPlatform();
    const sourcePlatform = manifest.nativeFor ?? 'universal';
    const filesToInstall = selectFilesForPlatform(manifest.files, activePlatform);
    const relInstallBase = path.relative(this.cwd, installBase).replace(/\\/g, '/');

    const writtenFiles: string[] = [];
    const fileResults: InstallFileResult[] = [];

    for (const file of filesToInstall) {
      const srcPath = path.join(agentsDir, file.src);
      let normalizedDest = file.dest.replace(/\\/g, '/');
      const relDest =
        relInstallBase && normalizedDest.startsWith(relInstallBase + '/')
          ? normalizedDest.slice(relInstallBase.length + 1)
          : normalizedDest;

      let destPath = path.resolve(installBase, relDest);
      const relDestPath = path.relative(this.cwd, destPath).replace(/\\/g, '/');

      let writeContent = fs.readFileSync(srcPath, 'utf8');
      let transformResult: TransformResult | undefined;

      if (sourcePlatform !== activePlatform && sourcePlatform !== 'universal') {
        transformResult = transform(writeContent, manifest.category, sourcePlatform, activePlatform, {
          destPath: relDestPath,
        });
        emitTransformMessages(relDestPath, transformResult);

        if (transformResult.recommendNativePath) {
          process.stderr.write(`[aitools] Advisory: ${transformResult.recommendNativePath}\n`);
          fileResults.push({ dest: relDestPath, transform: transformResult, skipped: true });
          continue;
        }

        if (transformResult.confidence === 'unsupported' && !transformResult.content.trim()) {
          process.stderr.write(
            `[aitools] Skipped ${relDestPath}: no ${activePlatform} equivalent for ${manifest.category}\n`,
          );
          if (transformResult.skillPrompt) {
            process.stderr.write(`[aitools] ${transformResult.skillPrompt}\n`);
          }
          fileResults.push({ dest: relDestPath, transform: transformResult, skipped: true });
          continue;
        }

        writeContent = transformResult.content;
        if (transformResult.destExtension) {
          destPath = path.resolve(installBase, applyDestExtension(relDest, transformResult));
        }
      }

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, writeContent, 'utf8');
      const writtenRel = path.relative(this.cwd, destPath).replace(/\\/g, '/');
      writtenFiles.push(writtenRel);
      fileResults.push({ dest: writtenRel, transform: transformResult });
    }

    if (writtenFiles.length > 0) {
      const descriptorDir = lowestCommonInstallDir(this.cwd, writtenFiles);
      const descriptorPath = path.join(descriptorDir, MANIFEST_FILENAME);
      fs.mkdirSync(descriptorDir, { recursive: true });
      fs.writeFileSync(descriptorPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      const descriptorRel = path.relative(this.cwd, descriptorPath).replace(/\\/g, '/');
      if (!writtenFiles.includes(descriptorRel)) {
        writtenFiles.push(descriptorRel);
      }
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
    const previousEntry = lock.tools[manifest.name];
    if (previousEntry) {
      const newFileSet = new Set(writtenFiles);
      for (const oldFile of previousEntry.files) {
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
    return { ...installedTool, fileResults };
  }

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

  uninstall(name: string): string[] {
    const lock = readLockFile(this.cwd);
    const entry = lock.tools[name];
    if (!entry) {
      throw new Error(`Tool "${name}" is not installed in this project.`);
    }

    const removed: string[] = [];

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

function emitTransformMessages(destPath: string, result: TransformResult): void {
  if (result.confidence === 'native' || result.confidence === 'high') return;

  if (result.confidence === 'low') {
    process.stderr.write(
      `[aitools] Low-confidence transform for ${destPath}. Run /aitools-convert for AI-assisted conversion.\n`,
    );
  } else if (result.confidence === 'medium') {
    process.stderr.write(`[aitools] Transform warnings for ${destPath}:\n`);
  } else if (result.confidence === 'unsupported') {
    process.stderr.write(`[aitools] Partial/unsupported transform for ${destPath}:\n`);
  }

  for (const w of result.warnings) {
    process.stderr.write(`  ${w}\n`);
  }

  if (result.skillPrompt) {
    process.stderr.write(`[aitools] ${result.skillPrompt}\n`);
  }
}

function selectFilesForPlatform(files: ToolFile[], activePlatform: TargetPlatform): ToolFile[] {
  const byDest = new Map<string, ToolFile>();
  for (const file of files) {
    if (!file.platform || file.platform === 'universal') {
      if (!byDest.has(file.dest)) byDest.set(file.dest, file);
    } else if (file.platform === activePlatform) {
      byDest.set(file.dest, file);
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

function lowestCommonInstallDir(cwd: string, writtenRelPaths: string[]): string {
  if (writtenRelPaths.length === 0) return cwd;
  const absDirs = writtenRelPaths.map((f) => path.dirname(path.resolve(cwd, f)));
  const splitDirs = absDirs.map((d) => d.split(path.sep));
  let common = splitDirs[0]!;
  for (const parts of splitDirs.slice(1)) {
    const len = Math.min(common.length, parts.length);
    let i = 0;
    while (i < len && common[i] === parts[i]) i++;
    common = common.slice(0, i);
  }
  return common.join(path.sep) || absDirs[0]!;
}

function cleanEmptyDirs(dir: string, stopAt: string): void {
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
    // Ignore
  }
}

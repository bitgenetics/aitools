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
import type { ToolManifest, InstalledTool, InstallScope, AiToolsLock, ToolFile, TargetPlatform, ToolCategory, PluginMember } from '@bitgenetics/aitools-core';
import {
  readLockFile,
  writeLockFile,
  upsertLockEntry,
  removeLockEntry,
  toLockEntry,
  normalizeCategory,
  MANIFEST_FILENAME,
  toPublishManifest,
  classifyPluginMembers,
  parseCursorPluginJson,
  resolveStoredPath,
  toStoredPath,
  trackingRoot,
  resolveCursorLocalPluginDir,
  sanitizePackageDirName,
  PLUGIN_PLATFORM_DESCRIPTOR,
} from '@bitgenetics/aitools-core';
import type { ConfigManager } from './config-manager.js';
import type { RegistryClient } from './registry-client.js';
import { toAdapterFileCategory } from '../adapters/types.js';
import { CacheManager } from './cache-manager.js';
import {
  transform,
  applyDestExtension,
  mergeHookConfigs,
  unmergeHookConfigs,
  extractHooksAdded,
  rewriteRelativePaths,
  buildPluginPathMap,
} from '../transformers/index.js';
import type { TransformResult } from '../transformers/index.js';

export interface InstallFileResult {
  dest: string;
  transform?: TransformResult;
  skipped?: boolean;
}

export interface InstallResult extends InstalledTool {
  fileResults: InstallFileResult[];
}

export interface InstallOptions {
  /** Opaque copy into ~/.cursor/plugins/local/ instead of explode. */
  cursorPlugin?: boolean;
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

  /** Lock/manifest directory for the given scope (cwd or ~/.aitools). */
  trackDir(scope: InstallScope): string {
    return trackingRoot(scope, this.cwd);
  }

  private stopDir(scope: InstallScope): string {
    return scope === 'user' ? os.homedir() : this.cwd;
  }

  /** Convert absolute install paths to portable stored form for return values / lock entries. */
  private toStoredInstalled(tool: InstalledTool, scope: InstallScope): InstalledTool {
    const track = this.trackDir(scope);
    return {
      ...tool,
      files: tool.files.map((f) => toStoredPath(track, f)),
      ...(tool.mcpConfig ? { mcpConfig: toStoredPath(track, tool.mcpConfig) } : {}),
      ...(tool.hooksConfig ? { hooksConfig: toStoredPath(track, tool.hooksConfig) } : {}),
    };
  }

  async install(
    client: RegistryClient,
    manifest: ToolManifest,
    scope: InstallScope,
    options: InstallOptions = {},
  ): Promise<InstallResult> {
    if (options.cursorPlugin) {
      return this.installCursorPluginLocal(client, manifest);
    }

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

    if (normalized === 'plugin') {
      return this.installPlugin(client, manifest, scope);
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
      writtenFiles.push(hooksConfigPath);
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

    const track = this.trackDir(scope);
    const lock = readLockFile(track);
    const updated = upsertLockEntry(lock, manifest.name, toLockEntry(installedTool, client.config.url));
    writeLockFile(track, updated);
    return { ...this.toStoredInstalled(installedTool, scope), fileResults };
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

    const installBase = this.configManager.resolveInstallPath(toAdapterFileCategory(manifest.category), scope);
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
      writtenFiles.push(destPath);
      fileResults.push({ dest: destPath, transform: transformResult });
    }

    const track = this.trackDir(scope);
    if (writtenFiles.length > 0) {
      const descriptorDir = lowestCommonInstallDirAbs(writtenFiles);
      const descriptorPath = path.join(descriptorDir, MANIFEST_FILENAME);
      fs.mkdirSync(descriptorDir, { recursive: true });
      fs.writeFileSync(descriptorPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      if (!writtenFiles.includes(descriptorPath)) {
        writtenFiles.push(descriptorPath);
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

    const lock = readLockFile(track);
    const previousEntry = lock.tools[manifest.name];
    if (previousEntry) {
      const newFileSet = new Set(writtenFiles.map((f) => path.resolve(f)));
      for (const oldFile of previousEntry.files) {
        const absOldFile = resolveStoredPath(track, oldFile);
        if (!newFileSet.has(path.resolve(absOldFile)) && fs.existsSync(absOldFile)) {
          fs.rmSync(absOldFile);
          cleanEmptyDirs(path.dirname(absOldFile), this.stopDir(scope));
        }
      }
    }

    const updated = upsertLockEntry(lock, manifest.name, toLockEntry(installedTool, client.config.url));
    writeLockFile(track, updated);
    return { ...this.toStoredInstalled(installedTool, scope), fileResults };
  }

  private async installPlugin(
    client: RegistryClient,
    manifest: ToolManifest,
    scope: InstallScope,
  ): Promise<InstallResult> {
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

    const sources = manifest.files.map((f) => f.src);
    let pluginJson = null;
    const descriptorRel = sources.find((s) => s.replace(/\\/g, '/') === '.cursor-plugin/plugin.json');
    if (descriptorRel) {
      const descriptorPath = path.join(agentsDir, descriptorRel);
      if (fs.existsSync(descriptorPath)) {
        pluginJson = parseCursorPluginJson(fs.readFileSync(descriptorPath, 'utf8'));
      }
    }

    const classified = classifyPluginMembers({
      packageName: manifest.name,
      sources,
      pluginJson,
    });
    if (classified.errors.length > 0) {
      throw new Error(
        `Plugin "${manifest.name}" has invalid structure:\n  ${classified.errors.join('\n  ')}`,
      );
    }

    const activePlatform = this.configManager.getPlatform();
    const sourcePlatform = manifest.nativeFor ?? 'universal';
    const track = this.trackDir(scope);
    const lock = readLockFile(track);
    const previousEntry = lock.tools[manifest.name];

    // On reinstall, unmerge previous hooks before merging the new set so handlers are not doubled.
    if (previousEntry?.hooksAdded && previousEntry.hooksConfig) {
      const hooksPath = resolveStoredPath(track, previousEntry.hooksConfig);
      if (fs.existsSync(hooksPath)) {
        const cleaned = unmergeHookConfigs(
          fs.readFileSync(hooksPath, 'utf8'),
          previousEntry.hooksAdded,
          previousEntry.platform ?? activePlatform,
        );
        fs.writeFileSync(hooksPath, cleaned, 'utf8');
      }
    }

    const members = classified.members.filter((m: PluginMember) => m.kind !== 'skip');

    // First pass: resolve final destinations for file members (needed for path map)
    type FilePlan = {
      member: (typeof members)[number];
      absDest: string;
      relDest: string;
      srcPath: string;
    };
    const filePlans: FilePlan[] = [];

    for (const member of members) {
      if (member.kind === 'mcp' || member.kind === 'hook') continue;
      if (!member.fileCategory) continue;

      const installBase = this.configManager.resolveInstallPath(member.fileCategory, scope);
      const absDest = path.resolve(installBase, member.destWithinCategory);
      const relDest = path.relative(this.cwd, absDest).replace(/\\/g, '/');
      filePlans.push({
        member,
        absDest,
        relDest,
        srcPath: path.join(agentsDir, member.src),
      });
    }

    const pathMap = buildPluginPathMap(
      filePlans.map((p) => ({ src: p.member.src, finalRel: p.relDest })),
    );

    const writtenFiles: string[] = [];
    const fileResults: InstallFileResult[] = [];
    const mcpKeys: string[] = [];
    let mcpConfigRel: string | undefined;
    let hooksAdded: Record<string, unknown[]> | undefined;
    let hooksConfigRel: string | undefined;

    for (const plan of filePlans) {
      if (!fs.existsSync(plan.srcPath)) {
        throw new Error(`Package "${manifest.name}@${manifest.version}" missing file: ${plan.member.src}`);
      }

      let writeContent = fs.readFileSync(plan.srcPath, 'utf8');
      let transformResult: TransformResult | undefined;
      let destPath = plan.absDest;
      let relDest = plan.relDest;

      const isText =
        /\.(md|mdc|json|ts|js|mjs|cjs|txt|ya?ml|toml|sh|py|prompt\.md|agent\.md)$/i.test(plan.member.src) ||
        plan.member.kind === 'skill' ||
        plan.member.kind === 'rule' ||
        plan.member.kind === 'command' ||
        plan.member.kind === 'agent';

      if (isText) {
        if (sourcePlatform !== activePlatform && sourcePlatform !== 'universal') {
          const category =
            plan.member.kind === 'asset' ? 'skill' : (plan.member.kind as ToolCategory);
          transformResult = transform(writeContent, category, sourcePlatform, activePlatform, {
            destPath: relDest,
          });
          emitTransformMessages(relDest, transformResult);

          if (transformResult.recommendNativePath) {
            process.stderr.write(`[aitools] Advisory: ${transformResult.recommendNativePath}\n`);
            fileResults.push({ dest: relDest, transform: transformResult, skipped: true });
            continue;
          }
          if (transformResult.confidence === 'unsupported' && !transformResult.content.trim()) {
            fileResults.push({ dest: relDest, transform: transformResult, skipped: true });
            continue;
          }
          writeContent = transformResult.content;
          if (transformResult.destExtension) {
            const baseRel = plan.member.destWithinCategory;
            const installBase = this.configManager.resolveInstallPath(plan.member.fileCategory!, scope);
            destPath = path.resolve(installBase, applyDestExtension(baseRel, transformResult));
            relDest = path.relative(this.cwd, destPath).replace(/\\/g, '/');
          }
        }

        const rewritten = rewriteRelativePaths(writeContent, pathMap);
        if (rewritten.warnings.length > 0 || rewritten.confidence !== 'native') {
          transformResult = {
            content: rewritten.content,
            confidence: rewritten.confidence,
            warnings: [...(transformResult?.warnings ?? []), ...rewritten.warnings],
            skillPrompt: transformResult?.skillPrompt,
            destExtension: transformResult?.destExtension,
          };
          emitTransformMessages(relDest, transformResult);
        }
        writeContent = rewritten.content;
      }

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, writeContent, 'utf8');
      writtenFiles.push(destPath);
      fileResults.push({ dest: destPath, transform: transformResult });
    }

    // MCP merge
    const mcpMember = members.find((m: PluginMember) => m.kind === 'mcp');
    if (mcpMember) {
      const mcpSrc = path.join(agentsDir, mcpMember.src);
      if (!fs.existsSync(mcpSrc)) {
        throw new Error(`Package "${manifest.name}@${manifest.version}" missing file: ${mcpMember.src}`);
      }
      let mcpContent = fs.readFileSync(mcpSrc, 'utf8');
      const rewritten = rewriteRelativePaths(mcpContent, pathMap);
      mcpContent = rewritten.content;
      for (const w of rewritten.warnings) {
        process.stderr.write(`[aitools] ${w}\n`);
      }

      const configPath = this.configManager.resolveMcpConfig(scope);
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      const keys = mergePluginMcpServers(configPath, mcpContent);
      mcpKeys.push(...keys);
      mcpConfigRel = configPath;
      fileResults.push({ dest: mcpConfigRel });
    }

    // Hooks merge
    const hookMember = members.find((m: PluginMember) => m.kind === 'hook');
    if (hookMember) {
      const hooksConfigPath = this.configManager.resolveHooksConfig(scope);
      if (!hooksConfigPath) {
        process.stderr.write(
          `[aitools] Skipping hooks from plugin "${manifest.name}": platform "${activePlatform}" has no hooks config.\n`,
        );
      } else {
        const hookSrc = path.join(agentsDir, hookMember.src);
        if (!fs.existsSync(hookSrc)) {
          throw new Error(`Package "${manifest.name}@${manifest.version}" missing file: ${hookMember.src}`);
        }
        let hookContent = fs.readFileSync(hookSrc, 'utf8');
        hookContent = normalizePluginHooksContent(hookContent);

        let transformResult: TransformResult | undefined;
        if (sourcePlatform !== activePlatform && sourcePlatform !== 'universal') {
          transformResult = transform(hookContent, 'hook', sourcePlatform, activePlatform, {
            destPath: path.relative(this.cwd, hooksConfigPath).replace(/\\/g, '/'),
          });
          emitTransformMessages(
            path.relative(this.cwd, hooksConfigPath).replace(/\\/g, '/'),
            transformResult,
          );
          if (!transformResult.recommendNativePath && transformResult.content.trim()) {
            hookContent = transformResult.content;
          } else if (transformResult.recommendNativePath || !transformResult.content.trim()) {
            fileResults.push({
              dest: path.relative(this.cwd, hooksConfigPath).replace(/\\/g, '/'),
              transform: transformResult,
              skipped: true,
            });
            hookContent = '';
          }
        }

        if (hookContent.trim()) {
          const rewritten = rewriteRelativePaths(hookContent, pathMap);
          hookContent = rewritten.content;
          for (const w of rewritten.warnings) {
            process.stderr.write(`[aitools] ${w}\n`);
          }

          hooksAdded = extractHooksAdded(hookContent, activePlatform);
          fs.mkdirSync(path.dirname(hooksConfigPath), { recursive: true });
          let existingContent: string | null = null;
          if (fs.existsSync(hooksConfigPath)) {
            existingContent = fs.readFileSync(hooksConfigPath, 'utf8');
          }
          const merged = mergeHookConfigs(existingContent, hookContent, activePlatform);
          fs.writeFileSync(hooksConfigPath, merged, 'utf8');
          hooksConfigRel = hooksConfigPath;
          fileResults.push({ dest: hooksConfigRel, transform: transformResult });
        }
      }
    }

    const installedTool: InstalledTool = {
      name: manifest.name,
      version: manifest.version,
      category: 'plugin',
      scope,
      platform: activePlatform,
      installedAt: new Date().toISOString(),
      files: writtenFiles,
      registry: client.config.url,
      integrity,
      ...(mcpKeys.length > 0 ? { mcpKeys, mcpConfig: mcpConfigRel } : {}),
      ...(hooksAdded && Object.keys(hooksAdded).length > 0
        ? { hooksAdded, hooksConfig: hooksConfigRel }
        : {}),
    };

    const lockAfter = readLockFile(track);
    const previous = lockAfter.tools[manifest.name];
    if (previous) {
      const newFileSet = new Set(writtenFiles.map((f) => path.resolve(f)));
      for (const oldFile of previous.files) {
        const absOldFile = resolveStoredPath(track, oldFile);
        if (!newFileSet.has(path.resolve(absOldFile)) && fs.existsSync(absOldFile)) {
          fs.rmSync(absOldFile);
          cleanEmptyDirs(path.dirname(absOldFile), this.stopDir(scope));
        }
      }
      if (previous.mcpKeys?.length && previous.mcpConfig) {
        const keep = new Set(mcpKeys);
        const stale = previous.mcpKeys.filter((k: string) => !keep.has(k));
        if (stale.length > 0) {
          removeMcpKeys(
            resolveStoredPath(track, previous.mcpConfig),
            stale,
          );
        }
      }
    }

    const updated = upsertLockEntry(lockAfter, manifest.name, toLockEntry(installedTool, client.config.url));
    writeLockFile(track, updated);
    return { ...this.toStoredInstalled(installedTool, scope), fileResults };
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

    const track = this.trackDir(scope);
    const installedTool: InstalledTool = {
      name: manifest.name,
      version: manifest.version,
      category: 'mcp-tool',
      scope,
      platform: this.configManager.getPlatform(),
      installedAt: new Date().toISOString(),
      files: [configPath],
      registry: registryUrl,
      integrity: 'mcp-config',
      mcpKeys: [serverKey],
      mcpConfig: configPath,
    };

    const lock = readLockFile(track);
    const updated = upsertLockEntry(lock, manifest.name, toLockEntry(installedTool, registryUrl));
    writeLockFile(track, updated);
    return this.toStoredInstalled(installedTool, scope);
  }

  /**
   * Opaque install into ~/.cursor/plugins/local/<name>/ for Cursor's plugin loader.
   * Always user-scoped; tracked under ~/.aitools only.
   */
  private async installCursorPluginLocal(
    client: RegistryClient,
    manifest: ToolManifest,
  ): Promise<InstallResult> {
    const scope: InstallScope = 'user';
    const { category: normalized } = normalizeCategory(manifest.category);
    if (normalized !== 'plugin') {
      throw new Error(
        `--cursor-plugin requires category "plugin" (got "${manifest.category}").`,
      );
    }

    const descriptorRel = PLUGIN_PLATFORM_DESCRIPTOR.cursor!;
    const hasDescriptor = manifest.files.some(
      (f) => f.src.replace(/\\/g, '/') === descriptorRel,
    );
    if (!hasDescriptor) {
      throw new Error(
        `--cursor-plugin requires ${descriptorRel} in the package files list.`,
      );
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

    const descriptorPath = path.join(agentsDir, descriptorRel);
    let pluginDirName = sanitizePackageDirName(manifest.name);
    if (fs.existsSync(descriptorPath)) {
      const pj = parseCursorPluginJson(fs.readFileSync(descriptorPath, 'utf8'));
      if (pj?.name && typeof pj.name === 'string' && pj.name.trim()) {
        pluginDirName = pj.name.trim();
      }
    }

    const destRoot = resolveCursorLocalPluginDir(pluginDirName);
    if (fs.existsSync(destRoot)) {
      fs.rmSync(destRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(destRoot, { recursive: true });

    const writtenFiles: string[] = [];
    for (const file of manifest.files) {
      const srcPath = path.join(agentsDir, file.src);
      if (!fs.existsSync(srcPath)) {
        throw new Error(`Package "${manifest.name}@${manifest.version}" missing file: ${file.src}`);
      }
      const destPath = path.join(destRoot, file.src);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      writtenFiles.push(destPath);
    }

    const track = this.trackDir(scope);
    const installedTool: InstalledTool = {
      name: manifest.name,
      version: manifest.version,
      category: 'plugin',
      scope,
      platform: 'cursor',
      installedAt: new Date().toISOString(),
      files: [destRoot],
      registry: client.config.url,
      integrity,
      installMethod: 'cursor-plugin-local',
    };

    const lock = readLockFile(track);
    const updated = upsertLockEntry(lock, manifest.name, toLockEntry(installedTool, client.config.url));
    writeLockFile(track, updated);

    const stored = this.toStoredInstalled(installedTool, scope);
    return {
      ...stored,
      fileResults: writtenFiles.map((dest) => ({ dest: toStoredPath(track, dest) })),
    };
  }

  uninstall(name: string, scope: InstallScope = 'project'): string[] {
    const track = this.trackDir(scope);
    const lock = readLockFile(track);
    const entry = lock.tools[name];
    if (!entry) {
      const where = scope === 'user' ? 'user scope' : 'this project';
      throw new Error(`Tool "${name}" is not installed in ${where}.`);
    }

    const removed: string[] = [];

    if (entry.installMethod === 'cursor-plugin-local') {
      for (const rawFile of entry.files) {
        const filePath = resolveStoredPath(track, rawFile);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { recursive: true, force: true });
          removed.push(filePath);
        }
      }
      const updated = removeLockEntry(lock, name);
      writeLockFile(track, updated);
      return removed;
    }

    const isMcpOnly =
      entry.category === 'mcp-tool' ||
      (entry.category === undefined && entry.integrity === 'mcp-config' && entry.files.length === 1);

    if (isMcpOnly) {
      const rawPath = entry.files[0]!;
      const configPath = resolveStoredPath(track, rawPath);
      removeMcpEntry(configPath, name);
      removed.push(configPath);
    } else {
      for (const rawFile of entry.files) {
        const filePath = resolveStoredPath(track, rawFile);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { recursive: true, force: true });
          removed.push(filePath);
          cleanEmptyDirs(path.dirname(filePath), this.stopDir(scope));
        }
      }

      if (entry.mcpKeys?.length) {
        const configPath = entry.mcpConfig
          ? resolveStoredPath(track, entry.mcpConfig)
          : null;
        if (configPath) {
          removeMcpKeys(configPath, entry.mcpKeys);
          removed.push(configPath);
        }
      }

      if (entry.hooksAdded && entry.hooksConfig) {
        const hooksPath = resolveStoredPath(track, entry.hooksConfig);
        if (fs.existsSync(hooksPath)) {
          const platform = entry.platform ?? this.configManager.getPlatform();
          const next = unmergeHookConfigs(fs.readFileSync(hooksPath, 'utf8'), entry.hooksAdded, platform);
          fs.writeFileSync(hooksPath, next, 'utf8');
          removed.push(hooksPath);
        }
      }
    }

    const updated = removeLockEntry(lock, name);
    writeLockFile(track, updated);
    return removed;
  }

  getLock(scope: InstallScope = 'project'): AiToolsLock {
    return readLockFile(this.trackDir(scope));
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
  mcpJson.servers ??= {};
  const serverKey = toolName.replace(/^@[^/]+\//, '');
  delete mcpJson.servers[serverKey];
  fs.writeFileSync(configPath, JSON.stringify(mcpJson, null, 2) + '\n', 'utf8');
}

function removeMcpKeys(configPath: string, keys: string[]): void {
  if (!fs.existsSync(configPath) || keys.length === 0) return;
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  const servers =
    (raw['servers'] as Record<string, unknown> | undefined) ??
    (raw['mcpServers'] as Record<string, unknown> | undefined) ??
    {};
  for (const key of keys) {
    delete servers[key];
  }
  if (raw['servers']) {
    raw['servers'] = servers;
  } else if (raw['mcpServers']) {
    raw['mcpServers'] = servers;
  } else {
    raw['servers'] = servers;
  }
  fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
}

/** Merge servers from a plugin mcp.json into the platform mcp config. Returns keys added. */
function mergePluginMcpServers(configPath: string, pluginMcpContent: string): string[] {
  const incoming = JSON.parse(pluginMcpContent) as Record<string, unknown>;
  const incomingServers =
    (incoming['mcpServers'] as Record<string, unknown> | undefined) ??
    (incoming['servers'] as Record<string, unknown> | undefined) ??
    {};

  let existing: Record<string, unknown> = { servers: {} };
  if (fs.existsSync(configPath)) {
    existing = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  }
  const servers =
    (existing['servers'] as Record<string, unknown> | undefined) ??
    (existing['mcpServers'] as Record<string, unknown> | undefined) ??
    {};

  const keys = Object.keys(incomingServers);
  for (const [key, value] of Object.entries(incomingServers)) {
    servers[key] = value;
  }

  // Prefer the key shape already present on disk; default to servers (aitools convention).
  if (existing['mcpServers'] && !existing['servers']) {
    existing['mcpServers'] = servers;
  } else {
    existing['servers'] = servers;
  }

  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return keys;
}

/** Unwrap Cursor plugin `{ "hooks": { ... } }` to top-level events for mergeHookConfigs. */
function normalizePluginHooksContent(content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed['hooks'] && typeof parsed['hooks'] === 'object' && !Array.isArray(parsed['hooks'])) {
      const inner = parsed['hooks'] as Record<string, unknown>;
      // If the only meaningful key is hooks, treat as nested Cursor marketplace format.
      const topKeys = Object.keys(parsed).filter((k) => k !== 'version');
      if (topKeys.length === 1 && topKeys[0] === 'hooks') {
        return JSON.stringify(inner, null, 2) + '\n';
      }
    }
  } catch {
    // leave as-is
  }
  return content;
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


function lowestCommonInstallDirAbs(writtenAbsPaths: string[]): string {
  if (writtenAbsPaths.length === 0) return os.homedir();
  const absDirs = writtenAbsPaths.map((f) => path.dirname(path.resolve(f)));
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

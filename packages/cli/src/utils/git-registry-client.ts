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
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import semver from 'semver';
import type { ToolManifest, GitRegistryConfig } from '@ai-tools/core';
import type { RegistryClient, SearchResult, PublishResult, DownloadResult } from './registry-client.js';

/** Convert a scoped package name like "@scope/name" to a safe directory name. */
export function sanitizeToolName(name: string): string {
  return name.replace(/\//g, '__');
}

export function runGit(args: string[], cwd: string): { stdout: string; stderr: string } {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || `exit code ${result.status}`).trim();
    throw new Error(`git ${args.join(' ')} failed: ${msg}`);
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function readBranch(config: GitRegistryConfig): string {
  return config.readBranch ?? 'main';
}

function publishBranch(config: GitRegistryConfig): string {
  return config.publishBranch ?? readBranch(config);
}

function registryRoot(config: GitRegistryConfig): string {
  const raw = config.path ?? 'registry/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function gitCacheDir(config: GitRegistryConfig): string {
  return path.join(os.homedir(), '.ai-tools', 'git-cache', config.name);
}

function toolDir(config: GitRegistryConfig, cloneRoot: string, name: string): string {
  return path.join(cloneRoot, registryRoot(config), sanitizeToolName(name));
}

function versionDir(config: GitRegistryConfig, cloneRoot: string, name: string, version: string): string {
  return path.join(toolDir(config, cloneRoot, name), version);
}

function buildTarballBuffer(files: Record<string, string>): Buffer {
  const entries = Object.entries(files).map(([filePath, content]) => ({
    path: filePath,
    content,
  }));
  return Buffer.from(JSON.stringify(entries), 'utf8');
}

function computeIntegrity(buf: Buffer): string {
  return 'sha256-' + crypto.createHash('sha256').update(buf).digest('base64');
}

function ensureGitIdentity(dir: string): void {
  const email = spawnSync('git', ['config', 'user.email'], { cwd: dir, encoding: 'utf8' });
  if (email.status !== 0 || !email.stdout?.trim()) {
    runGit(['config', 'user.email', 'aitools@localhost'], dir);
    runGit(['config', 'user.name', 'aitools'], dir);
  }
}

function branchExistsLocally(dir: string, branch: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', branch], { cwd: dir, encoding: 'utf8' });
  return result.status === 0;
}

function branchExistsRemotely(dir: string, branch: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', `origin/${branch}`], {
    cwd: dir,
    encoding: 'utf8',
  });
  return result.status === 0;
}

function ensureClone(config: GitRegistryConfig, branch: string): string {
  const dir = gitCacheDir(config);
  fs.mkdirSync(path.dirname(dir), { recursive: true });

  if (!fs.existsSync(path.join(dir, '.git'))) {
    const cloneArgs = ['clone', '--origin', 'origin', config.url, dir];
    const cloneResult = spawnSync('git', cloneArgs, { encoding: 'utf8' });
    if (cloneResult.status !== 0) {
      const msg = (cloneResult.stderr || cloneResult.stdout || '').trim();
      throw new Error(`git ${cloneArgs.join(' ')} failed: ${msg}`);
    }

    if (branchExistsRemotely(dir, branch)) {
      runGit(['checkout', branch], dir);
    } else if (!branchExistsLocally(dir, branch)) {
      runGit(['checkout', '-b', branch], dir);
    }
    return dir;
  }

  runGit(['fetch', 'origin'], dir);

  if (branchExistsRemotely(dir, branch)) {
    runGit(['checkout', branch], dir);
    runGit(['reset', '--hard', `origin/${branch}`], dir);
  } else if (branchExistsLocally(dir, branch)) {
    runGit(['checkout', branch], dir);
  } else {
    runGit(['checkout', '-b', branch], dir);
  }

  return dir;
}

function pushWithRebase(dir: string, branch: string): void {
  const push = spawnSync('git', ['push', 'origin', branch], { cwd: dir, encoding: 'utf8' });
  if (push.status === 0) return;

  runGit(['pull', '--rebase', 'origin', branch], dir);
  runGit(['push', 'origin', branch], dir);
}

async function walkManifests(
  config: GitRegistryConfig,
  cloneRoot: string,
): Promise<ToolManifest[]> {
  const root = path.join(cloneRoot, registryRoot(config));
  if (!fs.existsSync(root)) return [];

  const manifests: ToolManifest[] = [];

  for (const toolEntry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!toolEntry.isDirectory()) continue;
    const toolPath = path.join(root, toolEntry.name);
    const versions = fs
      .readdirSync(toolPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((v) => semver.valid(v) !== null)
      .sort(semver.rcompare);

    const latest = versions[0];
    if (!latest) continue;

    const manifestPath = path.join(toolPath, latest, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ToolManifest;
    manifests.push(manifest);
  }

  return manifests;
}

function resolveLatestVersion(config: GitRegistryConfig, cloneRoot: string, name: string): string | null {
  const dir = toolDir(config, cloneRoot, name);
  if (!fs.existsSync(dir)) return null;

  const versions = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((v) => semver.valid(v) !== null)
    .sort(semver.rcompare);

  return versions[0] ?? null;
}

/**
 * Git-backed registry client.
 * Reads and writes tool data via a local clone under ~/.ai-tools/git-cache/.
 */
export function createGitRegistryClient(config: GitRegistryConfig): RegistryClient {
  return {
    config,

    async getManifest(name: string, version = 'latest'): Promise<ToolManifest> {
      const cloneRoot = ensureClone(config, readBranch(config));
      const resolvedVersion = version === 'latest' ? resolveLatestVersion(config, cloneRoot, name) : version;
      if (!resolvedVersion) {
        throw new Error(`Registry ${config.name}: tool not found: ${name}@${version}`);
      }

      const manifestPath = path.join(
        versionDir(config, cloneRoot, name, resolvedVersion),
        'manifest.json',
      );
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Registry ${config.name}: tool not found: ${name}@${version}`);
      }

      return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ToolManifest;
    },

    async listVersions(name: string): Promise<string[]> {
      const cloneRoot = ensureClone(config, readBranch(config));
      const dir = toolDir(config, cloneRoot, name);
      if (!fs.existsSync(dir)) return [];

      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((v) => semver.valid(v) !== null)
        .sort(semver.rcompare);
    },

    async search(query: string): Promise<SearchResult[]> {
      const cloneRoot = ensureClone(config, readBranch(config));
      const term = query.startsWith('__smart__:')
        ? query.slice('__smart__:'.length).toLowerCase()
        : query.toLowerCase();

      const manifests = await walkManifests(config, cloneRoot);
      const results: SearchResult[] = [];

      for (const manifest of manifests) {
        const haystack = [
          manifest.name,
          manifest.description,
          manifest.category,
          ...(manifest.keywords ?? []),
          ...(manifest.tags ?? []),
        ]
          .join(' ')
          .toLowerCase();

        if (!term || haystack.includes(term)) {
          results.push({
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            category: manifest.category,
            keywords: manifest.keywords,
            registry: config.url,
          });
        }
      }

      return results;
    },

    async download(name: string, version: string): Promise<DownloadResult> {
      const cloneRoot = ensureClone(config, readBranch(config));
      const resolvedVersion = version === 'latest' ? resolveLatestVersion(config, cloneRoot, name) : version;
      if (!resolvedVersion) {
        throw new Error(`Registry ${config.name}: tool not found: ${name}@${version}`);
      }

      const tarballPath = path.join(
        versionDir(config, cloneRoot, name, resolvedVersion),
        'tool.json',
      );
      if (!fs.existsSync(tarballPath)) {
        throw new Error(`Registry ${config.name}: tarball not found: ${name}@${version}`);
      }

      const data = fs.readFileSync(tarballPath);
      return { data, integrity: computeIntegrity(data) };
    },

    async publish(manifest: ToolManifest, files: Record<string, string>): Promise<PublishResult> {
      const branch = publishBranch(config);
      const cloneRoot = ensureClone(config, branch);
      const versionDirectory = versionDir(config, cloneRoot, manifest.name, manifest.version);

      if (fs.existsSync(path.join(versionDirectory, 'manifest.json'))) {
        throw new Error(
          `Registry ${config.name}: version already exists: ${manifest.name}@${manifest.version}`,
        );
      }

      fs.mkdirSync(versionDirectory, { recursive: true });

      const tarball = buildTarballBuffer(files);
      const integrity = computeIntegrity(tarball);

      fs.writeFileSync(
        path.join(versionDirectory, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf8',
      );
      fs.writeFileSync(path.join(versionDirectory, 'tool.json'), tarball, 'utf8');

      ensureGitIdentity(cloneRoot);
      runGit(['add', path.relative(cloneRoot, versionDirectory)], cloneRoot);
      runGit(
        ['commit', '-m', `publish ${manifest.name}@${manifest.version}`],
        cloneRoot,
      );
      pushWithRebase(cloneRoot, branch);

      return { name: manifest.name, version: manifest.version, integrity };
    },
  };
}

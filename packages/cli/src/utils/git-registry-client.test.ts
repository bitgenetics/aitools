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
import os from 'node:os';
import path from 'node:path';
import type { GitRegistryConfig, ToolManifest } from '@aitools/core';
import {
  createGitRegistryClient,
  gitCacheDir,
  runGit,
  sanitizeToolName,
} from './git-registry-client.js';

function initBareRegistry(): { barePath: string; workPath: string; tmpRoot: string } {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'git-reg-test-'));
  const barePath = path.join(tmpRoot, 'registry.git');
  const workPath = path.join(tmpRoot, 'work');

  runGit(['init', '--bare', barePath], tmpRoot);
  runGit(['init', workPath], tmpRoot);
  runGit(['config', 'user.email', 'test@test.com'], workPath);
  runGit(['config', 'user.name', 'test'], workPath);
  fs.mkdirSync(path.join(workPath, 'registry'), { recursive: true });
  fs.writeFileSync(path.join(workPath, 'registry', '.gitkeep'), '\n', 'utf8');
  runGit(['add', '.'], workPath);
  runGit(['commit', '-m', 'init registry root'], workPath);
  runGit(['branch', '-M', 'main'], workPath);
  runGit(['remote', 'add', 'origin', barePath], workPath);
  runGit(['push', '-u', 'origin', 'main'], workPath);

  return { barePath, workPath, tmpRoot };
}

function makeGitConfig(barePath: string, name: string): GitRegistryConfig {
  return {
    type: 'git',
    name,
    url: barePath,
    readBranch: 'main',
    publishBranch: 'main',
    path: 'registry/',
  };
}

const FIXTURE_MANIFEST: ToolManifest = {
  name: 'git-test-skill',
  version: '1.0.0',
  description: 'Git registry test skill',
  category: 'skill',
  files: [{ src: 'index.md', dest: 'git-test-skill.md' }],
};

describe('sanitizeToolName', () => {
  it('encodes scoped names for filesystem paths', () => {
    expect(sanitizeToolName('@scope/name')).toBe('@scope__name');
  });
});

describe('runGit', () => {
  it('throws when git command fails', () => {
    expect(() => runGit(['status'], path.join(os.tmpdir(), 'nonexistent-git-dir-xyz'))).toThrow(
      'git status failed',
    );
  });
});

describe('createGitRegistryClient', () => {
  let tmpRoot: string;
  let barePath: string;
  let config: GitRegistryConfig;

  beforeEach(() => {
    ({ barePath, tmpRoot } = initBareRegistry());
    config = makeGitConfig(barePath, `git-reg-${Date.now()}`);
  });

  afterEach(() => {
    const cache = gitCacheDir(config);
    if (fs.existsSync(cache)) {
      fs.rmSync(cache, { recursive: true, force: true });
    }
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('publishes, downloads, and reads a manifest from the git registry', async () => {
    const client = createGitRegistryClient(config);

    const published = await client.publish(FIXTURE_MANIFEST, { 'index.md': '# Git test' });
    expect(published.integrity).toMatch(/^sha256-/);

    const manifest = await client.getManifest(FIXTURE_MANIFEST.name, FIXTURE_MANIFEST.version);
    expect(manifest.name).toBe(FIXTURE_MANIFEST.name);

    const { data, integrity } = await client.download(FIXTURE_MANIFEST.name, FIXTURE_MANIFEST.version);
    expect(integrity).toBe(published.integrity);
    expect(JSON.parse(data.toString('utf8'))).toEqual([
      { path: 'index.md', content: '# Git test' },
    ]);
  });

  it('lists versions for a published tool', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });

    const versions = await client.listVersions(FIXTURE_MANIFEST.name);
    expect(versions).toEqual(['1.0.0']);
  });

  it('finds published tools via search', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });

    const results = await client.search('git-test');
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe(FIXTURE_MANIFEST.name);
  });

  it('rejects publishing the same version twice', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });

    await expect(client.publish(FIXTURE_MANIFEST, { 'index.md': '# dup' })).rejects.toThrow(
      'version already exists',
    );
  });

  it('throws when tool is not found', async () => {
    const client = createGitRegistryClient(config);
    await expect(client.getManifest('missing-tool', '1.0.0')).rejects.toThrow('tool not found');
  });

  it('supports smart search queries', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });
    const results = await client.search('__smart__:git registry');
    expect(results.some((r) => r.name === FIXTURE_MANIFEST.name)).toBe(true);
  });

  it('downloads tarball for a published tool', async () => {
    const client = createGitRegistryClient(config);
    const published = await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });
    const { data, integrity } = await client.download(FIXTURE_MANIFEST.name, FIXTURE_MANIFEST.version);
    expect(integrity).toBe(published.integrity);
    expect(data.length).toBeGreaterThan(0);
  });

  it('resolves latest version when version is omitted', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });
    const manifest = await client.getManifest(FIXTURE_MANIFEST.name);
    expect(manifest.version).toBe('1.0.0');
  });

  it('reuses existing local clone on subsequent operations', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });
    const versions = await client.listVersions(FIXTURE_MANIFEST.name);
    const manifest = await client.getManifest(FIXTURE_MANIFEST.name, 'latest');
    expect(versions).toEqual(['1.0.0']);
    expect(manifest.name).toBe(FIXTURE_MANIFEST.name);
  });

  it('returns empty versions for an unknown tool', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });
    const versions = await client.listVersions('unknown-tool');
    expect(versions).toEqual([]);
  });

  it('supports custom publish branches that do not exist yet', async () => {
    const branchConfig: GitRegistryConfig = {
      ...config,
      name: `${config.name}-branch`,
      readBranch: 'develop',
      publishBranch: 'develop',
    };
    const client = createGitRegistryClient(branchConfig);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# branch' });
    const manifest = await client.getManifest(FIXTURE_MANIFEST.name, FIXTURE_MANIFEST.version);
    expect(manifest.name).toBe(FIXTURE_MANIFEST.name);
  });

  it('supports registry path without trailing slash', async () => {
    const pathConfig: GitRegistryConfig = {
      ...config,
      name: `${config.name}-path`,
      path: 'registry',
    };
    const client = createGitRegistryClient(pathConfig);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# path' });
    const manifest = await client.getManifest(FIXTURE_MANIFEST.name, FIXTURE_MANIFEST.version);
    expect(manifest.version).toBe('1.0.0');
  });

  it('returns all published tools for an empty search query', async () => {
    const client = createGitRegistryClient(config);
    await client.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });
    const results = await client.search('');
    expect(results.some((r) => r.name === FIXTURE_MANIFEST.name)).toBe(true);
  });

  it('supports scoped package names', async () => {
    const scoped: ToolManifest = {
      ...FIXTURE_MANIFEST,
      name: '@scope/git-skill',
      files: [{ src: 'index.md', dest: 'git-skill.md' }],
    };
    const client = createGitRegistryClient(config);
    await client.publish(scoped, { 'index.md': '# scoped' });
    const manifest = await client.getManifest('@scope/git-skill', '1.0.0');
    expect(manifest.name).toBe('@scope/git-skill');
  });

  it('supports publishing multiple tools from separate local caches', async () => {
    const clientA = createGitRegistryClient(config);
    const clientB = createGitRegistryClient({
      ...config,
      name: `${config.name}-peer`,
    });

    await clientA.publish(FIXTURE_MANIFEST, { 'index.md': '# v1' });

    const otherManifest: ToolManifest = {
      ...FIXTURE_MANIFEST,
      name: 'other-skill',
      version: '1.0.0',
      files: [{ src: 'index.md', dest: 'other-skill.md' }],
    };
    await clientB.publish(otherManifest, { 'index.md': '# other' });

    const results = await clientA.search('skill');
    expect(results.map((r) => r.name).sort()).toEqual(['git-test-skill', 'other-skill']);

    const cacheB = gitCacheDir({ ...config, name: `${config.name}-peer` });
    if (fs.existsSync(cacheB)) {
      fs.rmSync(cacheB, { recursive: true, force: true });
    }
  });
});

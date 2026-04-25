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
import { parsePackageArg } from './install.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Installer } from '../utils/installer.js';
import { ConfigManager } from '../utils/config-manager.js';
import { CacheManager } from '../utils/cache-manager.js';
import { readLockFile, writeManifest } from '@ai-tools/core';
import type { ToolManifest, RegistryConfig } from '@ai-tools/core';
import type { RegistryClient, DownloadResult } from '../utils/registry-client.js';

describe('parsePackageArg', () => {
  it('returns name only when no @ version suffix is present', () => {
    expect(parsePackageArg('my-skill')).toEqual({ name: 'my-skill', version: undefined });
  });

  it('splits name@version into name and version parts', () => {
    expect(parsePackageArg('my-skill@1.2.3')).toEqual({ name: 'my-skill', version: '1.2.3' });
  });

  it('handles scoped package names with a version suffix', () => {
    expect(parsePackageArg('@scope/my-skill@2.0.0')).toEqual({
      name: '@scope/my-skill',
      version: '2.0.0',
    });
  });

  it('handles scoped package names without a version suffix', () => {
    expect(parsePackageArg('@scope/my-skill')).toEqual({
      name: '@scope/my-skill',
      version: undefined,
    });
  });

  it('lets a versionOverride take precedence over the @version in the name', () => {
    expect(parsePackageArg('my-skill@1.0.0', '2.0.0')).toEqual({
      name: 'my-skill',
      version: '2.0.0',
    });
  });

  it('applies versionOverride even when name has no embedded version', () => {
    expect(parsePackageArg('my-skill', 'latest')).toEqual({
      name: 'my-skill',
      version: 'latest',
    });
  });

  it('handles a pre-release version tag', () => {
    expect(parsePackageArg('my-skill@1.0.0-beta.1')).toEqual({
      name: 'my-skill',
      version: '1.0.0-beta.1',
    });
  });
});

// ── Integration tests ────────────────────────────────────────────────────────

const SKILL_MANIFEST: ToolManifest = {
  name: 'test-skill',
  version: '2.0.0',
  description: 'A test skill',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'skill.md' }],
};

function makeTarball(content = '# Test Skill'): Buffer {
  return Buffer.from(JSON.stringify([{ path: 'skill.md', content }]), 'utf8');
}

function mockClient(config: RegistryConfig, manifest: ToolManifest | null, tarball?: Buffer): RegistryClient {
  return {
    config,
    getManifest: manifest
      ? jest.fn().mockResolvedValue(manifest)
      : jest.fn().mockRejectedValue(new Error('Not found')),
    listVersions: jest.fn().mockResolvedValue(manifest ? [manifest.version] : []),
    search: jest.fn().mockResolvedValue([]),
    download: jest.fn().mockResolvedValue({ data: tarball ?? makeTarball() } as DownloadResult),
    publish: jest.fn().mockRejectedValue(new Error('Not implemented')),
  };
}

describe('install integration: single package', () => {
  let tmp: string;
  let cacheTmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-install-int-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cache-int-'));
    fs.writeFileSync(path.join(tmp, 'ai-tools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('installs a tool and records it in the lock file with relative paths', async () => {
    const configManager = new ConfigManager(tmp);
    const installer = new Installer(configManager, tmp, new CacheManager(cacheTmp));
    const client = mockClient({ name: 'reg', url: 'http://localhost:4873' }, SKILL_MANIFEST);

    const installed = await installer.install(client, SKILL_MANIFEST, 'project');

    expect(installed.name).toBe('test-skill');
    expect(installed.version).toBe('2.0.0');
    // Paths are relative and use forward slashes
    for (const f of installed.files) {
      expect(path.isAbsolute(f)).toBe(false);
      expect(f).not.toContain('\\');
    }
    // Lock file written correctly
    const lock = readLockFile(tmp);
    expect(lock.tools['test-skill']).toBeDefined();
    expect(lock.tools['test-skill']!.version).toBe('2.0.0');
    expect(lock.tools['test-skill']!.files[0]).not.toContain('\\');
    // File actually exists on disk
    const absPath = path.resolve(tmp, installed.files[0]!);
    expect(fs.existsSync(absPath)).toBe(true);
  });

  it('verifies tarball integrity against server-provided hash', async () => {
    const tarball = makeTarball('# Verified');
    const crypto = await import('node:crypto');
    const expectedIntegrity = 'sha256-' + crypto.createHash('sha256').update(tarball).digest('base64');

    const client: RegistryClient = {
      config: { name: 'reg', url: 'http://localhost:4873' },
      getManifest: jest.fn().mockResolvedValue(SKILL_MANIFEST),
      listVersions: jest.fn().mockResolvedValue(['2.0.0']),
      search: jest.fn().mockResolvedValue([]),
      download: jest.fn().mockResolvedValue({ data: tarball, integrity: expectedIntegrity }),
      publish: jest.fn(),
    };

    const installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
    const installed = await installer.install(client, SKILL_MANIFEST, 'project');
    expect(installed.integrity).toBe(expectedIntegrity);
  });

  it('rejects tarball when integrity does not match server-provided hash', async () => {
    const tarball = makeTarball('# Tampered');
    const client: RegistryClient = {
      config: { name: 'reg', url: 'http://localhost:4873' },
      getManifest: jest.fn().mockResolvedValue(SKILL_MANIFEST),
      listVersions: jest.fn().mockResolvedValue(['2.0.0']),
      search: jest.fn().mockResolvedValue([]),
      download: jest.fn().mockResolvedValue({ data: tarball, integrity: 'sha256-WRONGHASH==' }),
      publish: jest.fn(),
    };

    const installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
    await expect(installer.install(client, SKILL_MANIFEST, 'project')).rejects.toThrow('Integrity check failed');
  });
});

describe('install integration: registry chaining', () => {
  let tmp: string;
  let cacheTmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-chain-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cache-chain-'));
    fs.writeFileSync(path.join(tmp, 'ai-tools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('falls through to second registry when first does not have the tool', async () => {
    const primaryClient = mockClient(
      { name: 'private', url: 'http://private:4873' },
      null, // tool not found
    );
    const secondaryClient = mockClient(
      { name: 'curated', url: 'http://curated:4873' },
      SKILL_MANIFEST,
    );

    const installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));

    // Simulate the chaining logic from install.ts: try registries in order
    let installed = null;
    for (const client of [primaryClient, secondaryClient]) {
      try {
        const manifest = await client.getManifest('test-skill', 'latest');
        installed = await installer.install(client, manifest, 'project');
        break;
      } catch {
        // Try next
      }
    }

    expect(installed).not.toBeNull();
    expect(installed!.name).toBe('test-skill');
    expect(installed!.registry).toBe('http://curated:4873');
  });

  it('uses first registry that has the tool even when multiple have it', async () => {
    const primaryManifest: ToolManifest = { ...SKILL_MANIFEST, version: '1.0.0' };
    const primaryClient = mockClient(
      { name: 'private', url: 'http://private:4873' },
      primaryManifest,
    );
    const secondaryClient = mockClient(
      { name: 'curated', url: 'http://curated:4873' },
      SKILL_MANIFEST, // version 2.0.0
    );

    const installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));

    let installed = null;
    for (const client of [primaryClient, secondaryClient]) {
      try {
        const manifest = await client.getManifest('test-skill', 'latest');
        installed = await installer.install(client, manifest, 'project');
        break;
      } catch {
        // Try next
      }
    }

    expect(installed).not.toBeNull();
    expect(installed!.version).toBe('1.0.0');
    expect(installed!.registry).toBe('http://private:4873');
  });
});

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
const mockGetManifest = jest.fn();
const mockDownload = jest.fn();
const mockListVersions = jest.fn();

jest.mock('../utils/registry-client.js', () => ({
  createRegistryClient: jest.fn(() => ({
    config: { name: 'reg', url: 'http://localhost:4873', type: 'http' },
    getManifest: (...args: unknown[]) => mockGetManifest(...args),
    listVersions: (...args: unknown[]) => mockListVersions(...args),
    search: jest.fn().mockResolvedValue([]),
    download: (...args: unknown[]) => mockDownload(...args),
    publish: jest.fn(),
  })),
}));

import { parsePackageArg } from './install.js';
import { createInstallCommand } from './install.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Installer } from '../utils/installer.js';
import { ConfigManager } from '../utils/config-manager.js';
import { CacheManager } from '../utils/cache-manager.js';
import { readLockFile, writeManifest, writeLockFile, upsertLockEntry, emptyLock } from '@bitgenetics/aitools-core';
import type { ToolManifest, RegistryConfig } from '@bitgenetics/aitools-core';
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

// -- Integration tests --------------------------------------------------------

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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-install-int-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-int-'));
    fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-chain-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-chain-'));
    fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
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

describe('install command action', () => {
  let tmp: string;
  let isolatedHome: string;
  const originalCwd = process.cwd();
  let homedirSpy: jest.SpiedFunction<typeof os.homedir>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-install-cmd-'));
    isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-install-home-'));
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(isolatedHome);
    delete process.env.VSCODE_PID;
    delete process.env.TERM_PROGRAM;
    delete process.env.CURSOR_TRACE_ID;
    process.chdir(tmp);
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({
        platform: 'vscode',
        registries: [{ type: 'http', name: 'reg', url: 'http://localhost:4873' }],
      }),
      'utf8',
    );
    mockGetManifest.mockReset();
    mockDownload.mockReset();
    mockListVersions.mockReset();
    mockGetManifest.mockResolvedValue(SKILL_MANIFEST);
    mockDownload.mockResolvedValue({ data: makeTarball() });
    mockListVersions.mockResolvedValue(['2.0.0']);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    homedirSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(isolatedHome, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('installs a package and writes aitools.json', async () => {
    await createInstallCommand().parseAsync(['test-skill'], { from: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as { tools: Record<string, string> };
    expect(manifest.tools['test-skill']).toBe('^2.0.0');
    expect(readLockFile(tmp).tools['test-skill']).toBeDefined();
  });

  it('saves dev dependencies when --dev is passed', async () => {
    await createInstallCommand().parseAsync(['test-skill', '--dev'], { from: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
      devTools: Record<string, string>;
    };
    expect(manifest.devTools['test-skill']).toBe('^2.0.0');
  });

  function mockExit(): jest.SpiedFunction<typeof process.exit> {
    return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
  }

  it('exits when no registries are configured', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
    const exitSpy = mockExit();
    await expect(createInstallCommand().parseAsync(['test-skill'], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('exits when package is not found in any registry', async () => {
    mockGetManifest.mockRejectedValue(new Error('Not found'));
    const exitSpy = mockExit();
    await expect(createInstallCommand().parseAsync(['missing-skill'], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('installs all tools listed in aitools.json', async () => {
    writeManifest(tmp, { tools: { 'test-skill': '^2.0.0' } });
    await createInstallCommand().parseAsync([], { from: 'user' });
    expect(readLockFile(tmp).tools['test-skill']).toBeDefined();
  });

  it('reports when aitools.json has no tools to install', async () => {
    writeManifest(tmp, { tools: {} });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createInstallCommand().parseAsync([], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('No tools listed');
  });

  it('exits when install-all is run without aitools.json', async () => {
    const exitSpy = mockExit();
    await expect(createInstallCommand().parseAsync([], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('prints universal platform tip after install', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ registries: [{ type: 'http', name: 'reg', url: 'http://localhost:4873' }] }),
      'utf8',
    );
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createInstallCommand().parseAsync(['test-skill'], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('.agents/');
  });

  it('prints auto-detected platform tip when platform is inferred', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ registries: [{ type: 'http', name: 'reg', url: 'http://localhost:4873' }] }),
      'utf8',
    );
    fs.mkdirSync(path.join(tmp, '.vscode'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createInstallCommand().parseAsync(['test-skill'], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('Auto-detected platform');
  });

  it('exits when installer fails during single package install', async () => {
    mockGetManifest.mockResolvedValue({
      ...SKILL_MANIFEST,
      name: 'fail-skill',
    });
    mockDownload.mockRejectedValue(new Error('network fail'));
    const exitSpy = mockExit();
    await expect(createInstallCommand().parseAsync(['fail-skill'], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('skips tools already satisfied during install-all', async () => {
    writeManifest(tmp, { tools: { 'test-skill': '^2.0.0' } });
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'test-skill', {
        version: '2.0.0',
        resolved: 'http://localhost:4873',
        integrity: 'sha256-x',
        files: ['skill.md'],
        installedAt: new Date().toISOString(),
      }),
    );
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createInstallCommand().parseAsync([], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('already satisfied');
  });

  it('reports failure for tools that cannot be resolved during install-all', async () => {
    writeManifest(tmp, { tools: { 'missing-skill': '^1.0.0' } });
    mockGetManifest.mockRejectedValue(new Error('Not found'));
    mockListVersions.mockRejectedValue(new Error('Not found'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createInstallCommand().parseAsync([], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('0 tool(s) installed');
  });
});

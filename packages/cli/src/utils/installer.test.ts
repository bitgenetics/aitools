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
import { Installer } from '../utils/installer.js';
import { ConfigManager } from '../utils/config-manager.js';
import { CacheManager } from '../utils/cache-manager.js';
import { writeLockFile, upsertLockEntry, emptyLock } from '@ai-tools/core';
import type { LockEntry, ToolManifest } from '@ai-tools/core';

const FIXED_DATE = '2024-01-01T00:00:00.000Z';

function makeLockEntry(files: string[], overrides: Partial<LockEntry> = {}): LockEntry {
  return {
    version: '1.0.0',
    resolved: 'https://registry.example.com/tarball',
    integrity: 'sha256-abc=',
    files,
    installedAt: FIXED_DATE,
    ...overrides,
  };
}

const SKILL_MANIFEST: ToolManifest = {
  name: 'my-skill',
  version: '1.0.0',
  description: 'A skill',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'skill.md' }],
};

describe('Installer.uninstall', () => {
  let tmp: string;
  let installer: Installer;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-installer-'));
    installer = new Installer(new ConfigManager(tmp), tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('throws when the tool is not recorded in the lock file', () => {
    expect(() => installer.uninstall('ghost')).toThrow('"ghost" is not installed');
  });

  it('removes the installed files from the filesystem', () => {
    const installedFile = path.join(tmp, 'skill.md');
    fs.writeFileSync(installedFile, '# Skill', 'utf8');
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry([installedFile])));

    installer.uninstall('my-skill');

    expect(fs.existsSync(installedFile)).toBe(false);
  });

  it('removes the tool from the lock file', () => {
    const installedFile = path.join(tmp, 'skill.md');
    fs.writeFileSync(installedFile, '# Skill', 'utf8');
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry([installedFile])));

    installer.uninstall('my-skill');

    expect(installer.getLock().tools['my-skill']).toBeUndefined();
  });

  it('returns the list of removed file paths', () => {
    const installedFile = path.join(tmp, 'skill.md');
    fs.writeFileSync(installedFile, '# Skill', 'utf8');
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry([installedFile])));

    const removed = installer.uninstall('my-skill');

    expect(removed).toContain(installedFile);
  });

  it('tolerates a file that was already removed from disk', () => {
    const missingFile = path.join(tmp, 'already-gone.md');
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry([missingFile])));

    expect(() => installer.uninstall('my-skill')).not.toThrow();
    expect(installer.getLock().tools['my-skill']).toBeUndefined();
  });
});

describe('Installer.install', () => {
  let tmp: string;
  let cacheTmp: string;
  let installer: Installer;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-installer-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cache-'));
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('writes tool files to disk and records the install in the lock file', async () => {
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'skill.md', content: '# My Skill' }]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    const installed = await installer.install(mockClient as never, SKILL_MANIFEST, 'project');

    expect(installed.name).toBe('my-skill');
    expect(installed.files).toHaveLength(1);
    expect(fs.existsSync(path.resolve(tmp, installed.files[0]!))).toBe(true);
    expect(installer.getLock().tools['my-skill']).toBeDefined();
  });

  it('throws when a file listed in the manifest is absent from the tarball', async () => {
    const tarball = Buffer.from(JSON.stringify([]), 'utf8');
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await expect(
      installer.install(mockClient as never, SKILL_MANIFEST, 'project'),
    ).rejects.toThrow('missing file: skill.md');
  });
});

describe('Installer.getLock', () => {
  it('returns an empty lock when no lock file exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-installer-'));
    try {
      const installer = new Installer(new ConfigManager(tmp), tmp);
      expect(installer.getLock()).toEqual({ lockfileVersion: 1, tools: {} });
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});


describe('Installer.install (cache behaviour)', () => {
  let tmp: string;
  let cacheTmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-installer-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cache-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('does not call download when the tarball is already cached', async () => {
    const { CacheManager } = await import('../utils/cache-manager.js');
    const cache = new CacheManager(cacheTmp);
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'skill.md', content: '# Cached Skill' }]),
      'utf8',
    );
    cache.store(SKILL_MANIFEST.name, SKILL_MANIFEST.version, tarball, SKILL_MANIFEST);

    const mockDownload = jest.fn();
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: mockDownload,
    };
    const installer = new Installer(new ConfigManager(tmp), tmp, cache);

    await installer.install(mockClient as never, SKILL_MANIFEST, 'project');

    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('calls download and populates the cache on a cache miss', async () => {
    const { CacheManager } = await import('../utils/cache-manager.js');
    const cache = new CacheManager(cacheTmp);
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'skill.md', content: '# Fresh Skill' }]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };
    const installer = new Installer(new ConfigManager(tmp), tmp, cache);

    await installer.install(mockClient as never, SKILL_MANIFEST, 'project');

    expect(cache.has(SKILL_MANIFEST.name, SKILL_MANIFEST.version)).toBe(true);
  });
});



// -- MCP tool install --------------------------------------------------------

const MCP_MANIFEST: ToolManifest = {
  name: 'my-mcp-server',
  version: '1.0.0',
  description: 'An MCP server',
  category: 'mcp-tool',
  files: [],
  mcpServer: { type: 'stdio', command: 'npx', args: ['-y', '@scope/server'] },
};

describe('Installer.install (mcp-tool)', () => {
  let tmp: string;
  let installer: Installer;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-mcp-'));
    installer = new Installer(new ConfigManager(tmp), tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  const mockClient = () => ({
    config: { name: 'r', url: 'http://registry.example.com' } as never,
    getManifest: jest.fn(),
    search: jest.fn(),
    download: jest.fn(),
  });

  it('creates mcp.json with the server entry on first install', async () => {
    const installed = await installer.install(mockClient() as never, MCP_MANIFEST, 'project');

    const mcpPath = path.resolve(tmp, installed.files[0]!);
    expect(fs.existsSync(mcpPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(mcpPath, 'utf8')) as { servers: Record<string, unknown> };
    expect(json.servers['my-mcp-server']).toBeDefined();
  });

  it('merges into an existing mcp.json without removing other entries', async () => {
    const mcpPath = new ConfigManager(tmp).resolveMcpConfig('project');
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(
      mcpPath,
      JSON.stringify({ servers: { 'existing-server': { type: 'stdio', command: 'node' } } }) + '\n',
      'utf8',
    );

    await installer.install(mockClient() as never, MCP_MANIFEST, 'project');

    const json = JSON.parse(fs.readFileSync(mcpPath, 'utf8')) as { servers: Record<string, unknown> };
    expect(json.servers['existing-server']).toBeDefined();
    expect(json.servers['my-mcp-server']).toBeDefined();
  });

  it('records the install in the lock file with mcp-config integrity', async () => {
    await installer.install(mockClient() as never, MCP_MANIFEST, 'project');

    expect(installer.getLock().tools['my-mcp-server']?.integrity).toBe('mcp-config');
  });

  it('throws when the manifest has no mcpServer descriptor', async () => {
    const badManifest: ToolManifest = { ...MCP_MANIFEST, mcpServer: undefined };

    await expect(
      installer.install(mockClient() as never, badManifest, 'project'),
    ).rejects.toThrow('no mcpServer descriptor');
  });
});

describe('Installer.uninstall (mcp-tool)', () => {
  let tmp: string;
  let installer: Installer;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-mcp-'));
    installer = new Installer(new ConfigManager(tmp), tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('removes the server entry from mcp.json without deleting the file', () => {
    const mcpPath = new ConfigManager(tmp).resolveMcpConfig('project');
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(
      mcpPath,
      JSON.stringify({
        servers: {
          'my-mcp-server': { type: 'stdio', command: 'npx' },
          'other-server':  { type: 'stdio', command: 'node' },
        },
      }) + '\n',
      'utf8',
    );
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'my-mcp-server', {
        version: '1.0.0',
        resolved: 'http://registry.example.com',
        integrity: 'mcp-config',
        files: [mcpPath],
        installedAt: FIXED_DATE,
      }),
    );

    installer.uninstall('my-mcp-server');

    const json = JSON.parse(fs.readFileSync(mcpPath, 'utf8')) as { servers: Record<string, unknown> };
    expect(json.servers['my-mcp-server']).toBeUndefined();
    expect(json.servers['other-server']).toBeDefined();
  });

  it('leaves the lock file clean after uninstalling an mcp tool', () => {
    const mcpPath = new ConfigManager(tmp).resolveMcpConfig('project');
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(
      mcpPath,
      JSON.stringify({ servers: { 'my-mcp-server': { type: 'stdio', command: 'npx' } } }) + '\n',
      'utf8',
    );
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'my-mcp-server', {
        version: '1.0.0',
        resolved: 'http://registry.example.com',
        integrity: 'mcp-config',
        files: [mcpPath],
        installedAt: FIXED_DATE,
      }),
    );

    installer.uninstall('my-mcp-server');

    expect(installer.getLock().tools['my-mcp-server']).toBeUndefined();
  });

});

describe('Installer.install (platform-aware file selection)', () => {
  let tmp: string;
  let cacheTmp: string;
  let installer: Installer;

  function makeClient(tarball: Buffer) {
    return {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-platform-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cache-'));
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('installs platform-specific file when it matches the active platform', async () => {
    const manifest: ToolManifest = {
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
      category: 'skill',
      files: [
        { src: 'skill.vscode.md', dest: 'skill.md', platform: 'vscode' },
        { src: 'skill.claude.md', dest: 'skill.md', platform: 'claude' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: 'skill.vscode.md', content: '# VS Code Skill' },
        { path: 'skill.claude.md', content: '# Claude Skill' },
      ]),
      'utf8',
    );
    const installed = await installer.install(makeClient(tarball) as never, manifest, 'project');
    expect(installed.files).toHaveLength(1);
  });


  it('falls back to unscoped file when no platform-specific entry matches', async () => {
    const manifest: ToolManifest = {
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
      category: 'skill',
      files: [
        { src: 'skill.md', dest: 'skill.md' },
        { src: 'skill.claude.md', dest: 'skill.md', platform: 'claude' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: 'skill.md', content: '# Generic Skill' },
        { path: 'skill.claude.md', content: '# Claude Skill' },
      ]),
      'utf8',
    );
    const installed = await installer.install(makeClient(tarball) as never, manifest, 'project');
    expect(installed.files).toHaveLength(1);
  });

  it('strips the install-base prefix from dest when manifest uses project-relative paths', async () => {
    const manifest: ToolManifest = {
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
      category: 'skill',
      files: [
        { src: '.agents/skills/my-skill/SKILL.md', dest: '.agents/skills/my-skill/SKILL.md' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: '.agents/skills/my-skill/SKILL.md', content: '# My Skill' }]),
      'utf8',
    );
    const installed = await installer.install(makeClient(tarball) as never, manifest, 'project');
    // Should land at <tmp>/.agents/skills/my-skill/SKILL.md, not double-nested
    expect(installed.files[0]).toMatch(/my-skill[\/\\]SKILL\.md$/);
    expect(installed.files[0]).not.toContain('.agents' + path.sep + 'skills' + path.sep + '.agents');
  });
});

describe('Installer.install (manifest platforms guard)', () => {
  let tmp: string;
  let cacheTmp: string;
  let installer: Installer;

  function makeClient(tarball: Buffer) {
    return {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };
  }

  function makeTarball() {
    return Buffer.from(
      JSON.stringify([{ path: 'skill.md', content: '# Skill' }]),
      'utf8',
    );
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-plat-guard-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cache-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('installs when manifest.platforms includes the active platform', async () => {
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
    const manifest: ToolManifest = {
      name: 'vscode-only-skill',
      version: '1.0.0',
      description: 'VS Code skill',
      category: 'skill',
      files: [{ src: 'skill.md', dest: 'skill.md' }],
      platforms: ['vscode'],
    };
    await expect(installer.install(makeClient(makeTarball()) as never, manifest, 'project')).resolves.toBeDefined();
  });

  it('installs when manifest.platforms includes universal', async () => {
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
      JSON.stringify({ platform: 'claude' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
    const manifest: ToolManifest = {
      name: 'universal-skill',
      version: '1.0.0',
      description: 'Universal skill',
      category: 'skill',
      files: [{ src: 'skill.md', dest: 'skill.md' }],
      platforms: ['universal'],
    };
    await expect(installer.install(makeClient(makeTarball()) as never, manifest, 'project')).resolves.toBeDefined();
  });

  it('throws when manifest.platforms does not include the active platform', async () => {
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
      JSON.stringify({ platform: 'claude' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
    const manifest: ToolManifest = {
      name: 'vscode-only-skill',
      version: '1.0.0',
      description: 'VS Code only',
      category: 'skill',
      files: [{ src: 'skill.md', dest: 'skill.md' }],
      platforms: ['vscode'],
    };
    await expect(installer.install(makeClient(makeTarball()) as never, manifest, 'project')).rejects.toThrow(
      '"vscode-only-skill" only supports platforms: vscode',
    );
  });

  it('installs when manifest.platforms is omitted (no restriction)', async () => {
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
    const manifest: ToolManifest = {
      name: 'any-skill',
      version: '1.0.0',
      description: 'Any platform',
      category: 'skill',
      files: [{ src: 'skill.md', dest: 'skill.md' }],
    };
    await expect(installer.install(makeClient(makeTarball()) as never, manifest, 'project')).resolves.toBeDefined();
  });
});

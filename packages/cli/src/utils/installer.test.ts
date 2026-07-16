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
import { Installer } from '../utils/installer.js';
import { ConfigManager } from '../utils/config-manager.js';
import { CacheManager } from '../utils/cache-manager.js';
import { writeLockFile, upsertLockEntry, emptyLock } from '@bitgenetics/aitools-core';
import type { LockEntry, ToolManifest } from '@bitgenetics/aitools-core';

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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-installer-'));
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-installer-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
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
    expect(installed.files).toHaveLength(2);
    expect(installed.files.some((f) => f.endsWith('aitools.json'))).toBe(true);
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

  it('warns when installing a deprecated subagent category', async () => {
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'agent.md', content: '# Agent' }]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };
    const manifest: ToolManifest = {
      ...SKILL_MANIFEST,
      name: 'my-agent',
      category: 'subagent',
      files: [{ src: 'agent.md', dest: 'agent.md' }],
    };

    await installer.install(mockClient as never, manifest, 'project');

    expect(stderrSpy.mock.calls.some((call) => String(call[0]).includes('subagent'))).toBe(true);
    stderrSpy.mockRestore();
  });

  it('removes stale skill files when reinstalling a different file set', async () => {
    installer = new Installer(new ConfigManager(tmp, { platform: 'universal' }), tmp, new CacheManager(cacheTmp));

    const MANIFEST_V1: ToolManifest = {
      name: 'reinstall-skill',
      version: '1.0.0',
      description: 'Skill v1',
      category: 'skill',
      files: [{ src: 'old.md', dest: 'old.md' }],
    };
    const MANIFEST_V2: ToolManifest = {
      ...MANIFEST_V1,
      version: '2.0.0',
      files: [{ src: 'new.md', dest: 'new.md' }],
    };
    const tarballV1 = Buffer.from(
      JSON.stringify([{ path: 'old.md', content: '# Old' }]),
      'utf8',
    );
    const tarballV2 = Buffer.from(
      JSON.stringify([{ path: 'new.md', content: '# New' }]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest
        .fn()
        .mockResolvedValueOnce({ data: tarballV1 })
        .mockResolvedValueOnce({ data: tarballV2 }),
    };

    await installer.install(mockClient as never, MANIFEST_V1, 'project');
    const oldPath = path.join(tmp, '.agents', 'skills', 'old.md');
    expect(fs.existsSync(oldPath)).toBe(true);

    await installer.install(mockClient as never, MANIFEST_V2, 'project');
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(path.join(tmp, '.agents', 'skills', 'new.md'))).toBe(true);
  });

  it('explodes a plugin into platform skill/rule dirs (not .agents/plugins)', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp);

    const PLUGIN_MANIFEST: ToolManifest = {
      name: '@team/my-plugin',
      version: '1.0.0',
      description: 'A plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/review/SKILL.md', dest: 'skills/review/SKILL.md' },
        { src: 'rules/style.mdc', dest: 'rules/style.mdc' },
        { src: 'scripts/format.sh', dest: 'scripts/format.sh' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{"name":"my-plugin"}' },
        { path: 'skills/review/SKILL.md', content: '# Review' },
        { path: 'rules/style.mdc', content: '---\ndescription: style\nalwaysApply: true\n---\nBe tidy.' },
        { path: 'scripts/format.sh', content: '#!/bin/sh\necho ok\n' },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    const installed = await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    expect(fs.existsSync(path.join(tmp, '.cursor', 'skills', 'review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '.cursor', 'rules', 'style.mdc'))).toBe(true);
    expect(
      fs.existsSync(path.join(tmp, '.cursor', 'skills', '@team__my-plugin', 'scripts', 'format.sh')),
    ).toBe(true);
    expect(fs.existsSync(path.join(tmp, '.agents', 'plugins', '@team__my-plugin'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, '.cursor', 'plugins', 'local', '@team__my-plugin'))).toBe(false);
    expect(installed.files.some((f) => f.includes('.cursor/skills/review/SKILL.md'))).toBe(true);
  });

  it('rejects a plugin with orphan paths before writing', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp);

    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'bad-plugin',
      version: '1.0.0',
      description: 'A plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'orphan.bin', dest: 'orphan.bin' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        { path: 'orphan.bin', content: 'x' },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await expect(installer.install(mockClient as never, PLUGIN_MANIFEST, 'project')).rejects.toThrow(
      /no install home/,
    );
  });
});

describe('Installer.install (plugin explode mcp+hooks)', () => {
  let tmp: string;
  let cacheTmp: string;
  let installer: Installer;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-plugin-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('merges plugin mcp servers and records mcpKeys for uninstall', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'mcp-plugin',
      version: '1.0.0',
      description: 'Plugin with MCP',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/x/SKILL.md', dest: 'skills/x/SKILL.md' },
        { src: 'mcp.json', dest: 'mcp.json' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        { path: 'skills/x/SKILL.md', content: '# X' },
        {
          path: 'mcp.json',
          content: JSON.stringify({
            mcpServers: { 'plugin-db': { command: 'npx', args: ['-y', 'server'] } },
          }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    const mcpDir = path.join(tmp, '.cursor');
    fs.mkdirSync(mcpDir, { recursive: true });
    fs.writeFileSync(
      path.join(mcpDir, 'mcp.json'),
      JSON.stringify({ servers: { keep: { command: 'node' } } }) + '\n',
      'utf8',
    );

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');
    const lock = installer.getLock().tools['mcp-plugin']!;
    expect(lock.mcpKeys).toEqual(['plugin-db']);

    const mcp = JSON.parse(fs.readFileSync(path.join(mcpDir, 'mcp.json'), 'utf8')) as {
      servers: Record<string, unknown>;
    };
    expect(mcp.servers['keep']).toBeDefined();
    expect(mcp.servers['plugin-db']).toBeDefined();

    installer.uninstall('mcp-plugin');
    const after = JSON.parse(fs.readFileSync(path.join(mcpDir, 'mcp.json'), 'utf8')) as {
      servers: Record<string, unknown>;
    };
    expect(after.servers['plugin-db']).toBeUndefined();
    expect(after.servers['keep']).toBeDefined();
    expect(fs.existsSync(path.join(tmp, '.cursor', 'skills', 'x', 'SKILL.md'))).toBe(false);
  });

  it('rewrites hook script paths and uninstalls hook handlers cleanly', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'hook-plugin',
      version: '1.0.0',
      description: 'Plugin with hooks',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'scripts/fmt.sh', dest: 'scripts/fmt.sh' },
        { src: 'hooks/hooks.json', dest: 'hooks/hooks.json' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        { path: 'scripts/fmt.sh', content: '#!/bin/sh\n' },
        {
          path: 'hooks/hooks.json',
          content: JSON.stringify({
            hooks: { afterFileEdit: [{ command: './scripts/fmt.sh' }] },
          }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    const hooksPath = path.join(tmp, '.cursor', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8')) as {
      afterFileEdit: Array<{ command: string }>;
    };
    expect(hooks.afterFileEdit[0]!.command).toContain('.cursor/skills/hook-plugin/scripts/fmt.sh');

    fs.writeFileSync(
      hooksPath,
      JSON.stringify({
        afterFileEdit: hooks.afterFileEdit,
        sessionStart: [{ command: 'echo keep' }],
      }) + '\n',
      'utf8',
    );

    installer.uninstall('hook-plugin');
    const after = JSON.parse(fs.readFileSync(hooksPath, 'utf8')) as Record<string, unknown[]>;
    expect(after.afterFileEdit).toBeUndefined();
    expect(after.sessionStart).toHaveLength(1);
  });

  it('merges mcpServers-shaped plugin config into existing mcpServers file', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'mcp-shape-plugin',
      version: '1.0.0',
      description: 'Plugin with MCP',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'mcp.json', dest: 'mcp.json' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'mcp.json',
          content: JSON.stringify({
            mcpServers: { 'plugin-shape': { command: 'node', args: ['server.js'] } },
          }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    const mcpDir = path.join(tmp, '.cursor');
    fs.mkdirSync(mcpDir, { recursive: true });
    fs.writeFileSync(
      path.join(mcpDir, 'mcp.json'),
      JSON.stringify({ mcpServers: { keep: { command: 'node' } } }) + '\n',
      'utf8',
    );

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    const mcp = JSON.parse(fs.readFileSync(path.join(mcpDir, 'mcp.json'), 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(mcp.mcpServers['keep']).toBeDefined();
    expect(mcp.mcpServers['plugin-shape']).toBeDefined();
    expect(installer.getLock().tools['mcp-shape-plugin']!.mcpKeys).toEqual(['plugin-shape']);
  });

  it('skips hooks on universal platform without a hooks config', async () => {
    installer = new Installer(new ConfigManager(tmp, { platform: 'universal' }), tmp, new CacheManager(cacheTmp));

    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'hook-skip-plugin',
      version: '1.0.0',
      description: 'Plugin with hooks',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'hooks/hooks.json', dest: 'hooks/hooks.json' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'hooks/hooks.json',
          content: JSON.stringify({ afterFileEdit: [{ command: 'echo hi' }] }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    expect(fs.existsSync(path.join(tmp, '.cursor', 'hooks.json'))).toBe(false);
    expect(installer.getLock().tools['hook-skip-plugin']!.hooksAdded).toBeUndefined();
  });

  it('removes stale plugin files on reinstall', async () => {
    const PLUGIN_V1: ToolManifest = {
      name: 'reinstall-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/old/SKILL.md', dest: 'skills/old/SKILL.md' },
      ],
    };
    const PLUGIN_V2: ToolManifest = {
      ...PLUGIN_V1,
      version: '2.0.0',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/new/SKILL.md', dest: 'skills/new/SKILL.md' },
      ],
    };
    const tarballV1 = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        { path: 'skills/old/SKILL.md', content: '# Old' },
      ]),
      'utf8',
    );
    const tarballV2 = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        { path: 'skills/new/SKILL.md', content: '# New' },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest
        .fn()
        .mockResolvedValueOnce({ data: tarballV1 })
        .mockResolvedValueOnce({ data: tarballV2 }),
    };

    await installer.install(mockClient as never, PLUGIN_V1, 'project');
    expect(fs.existsSync(path.join(tmp, '.cursor', 'skills', 'old', 'SKILL.md'))).toBe(true);

    await installer.install(mockClient as never, PLUGIN_V2, 'project');
    expect(fs.existsSync(path.join(tmp, '.cursor', 'skills', 'old', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, '.cursor', 'skills', 'new', 'SKILL.md'))).toBe(true);
  });

  it('unmerges previous hooks before reinstalling a plugin', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'hook-reinstall-plugin',
      version: '1.0.0',
      description: 'Plugin with hooks',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'hooks/hooks.json', dest: 'hooks/hooks.json' },
      ],
    };
    const tarballV1 = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'hooks/hooks.json',
          content: JSON.stringify({ afterFileEdit: [{ command: 'echo v1' }] }),
        },
      ]),
      'utf8',
    );
    const tarballV2 = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'hooks/hooks.json',
          content: JSON.stringify({ sessionStart: [{ command: 'echo v2' }] }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest
        .fn()
        .mockResolvedValueOnce({ data: tarballV1 })
        .mockResolvedValueOnce({ data: tarballV2 }),
    };

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');
    await installer.install(mockClient as never, { ...PLUGIN_MANIFEST, version: '2.0.0' }, 'project');

    const hooks = JSON.parse(fs.readFileSync(path.join(tmp, '.cursor', 'hooks.json'), 'utf8')) as {
      afterFileEdit?: unknown[];
      sessionStart?: unknown[];
    };
    expect(hooks.afterFileEdit).toBeUndefined();
    expect(hooks.sessionStart).toHaveLength(1);
  });

  it('uses cached plugin tarball on reinstall without downloading again', async () => {
    const cache = new CacheManager(cacheTmp);
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'cached-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/x/SKILL.md', dest: 'skills/x/SKILL.md' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        { path: 'skills/x/SKILL.md', content: '# X' },
      ]),
      'utf8',
    );
    cache.store(PLUGIN_MANIFEST.name, PLUGIN_MANIFEST.version, tarball, PLUGIN_MANIFEST);
    const mockDownload = jest.fn();
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: mockDownload,
    };
    installer = new Installer(new ConfigManager(tmp), tmp, cache);

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    expect(mockDownload).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmp, '.cursor', 'skills', 'x', 'SKILL.md'))).toBe(true);
  });

  it('removes stale mcp keys when reinstalling a plugin with a different server set', async () => {
    const PLUGIN_V1: ToolManifest = {
      name: 'mcp-reinstall-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'mcp.json', dest: 'mcp.json' },
      ],
    };
    const PLUGIN_V2: ToolManifest = {
      ...PLUGIN_V1,
      version: '2.0.0',
    };
    const tarballV1 = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'mcp.json',
          content: JSON.stringify({ servers: { 'old-server': { command: 'node' } } }),
        },
      ]),
      'utf8',
    );
    const tarballV2 = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'mcp.json',
          content: JSON.stringify({ servers: { 'new-server': { command: 'node' } } }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest
        .fn()
        .mockResolvedValueOnce({ data: tarballV1 })
        .mockResolvedValueOnce({ data: tarballV2 }),
    };

    await installer.install(mockClient as never, PLUGIN_V1, 'project');
    await installer.install(mockClient as never, PLUGIN_V2, 'project');

    const mcp = JSON.parse(fs.readFileSync(path.join(tmp, '.cursor', 'mcp.json'), 'utf8')) as {
      servers: Record<string, unknown>;
    };
    expect(mcp.servers['old-server']).toBeUndefined();
    expect(mcp.servers['new-server']).toBeDefined();
  });

  it('unwraps nested marketplace hooks.json before merge', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'nested-hook-plugin',
      version: '1.0.0',
      description: 'Plugin with nested hooks',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'hooks/hooks.json', dest: 'hooks/hooks.json' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'hooks/hooks.json',
          content: JSON.stringify({
            version: 1,
            hooks: { afterFileEdit: [{ command: 'echo nested' }] },
          }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    const hooks = JSON.parse(fs.readFileSync(path.join(tmp, '.cursor', 'hooks.json'), 'utf8')) as {
      afterFileEdit: Array<{ command: string }>;
    };
    expect(hooks.afterFileEdit[0]!.command).toBe('echo nested');
  });

  it('throws when a plugin lists mcp.json but the tarball omits it', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'missing-mcp-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'mcp.json', dest: 'mcp.json' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: '.cursor-plugin/plugin.json', content: '{}' }]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await expect(installer.install(mockClient as never, PLUGIN_MANIFEST, 'project')).rejects.toThrow(
      /missing file: mcp.json/,
    );
  });

  it('throws when a plugin skill file is missing from the tarball', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'missing-skill-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/x/SKILL.md', dest: 'skills/x/SKILL.md' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: '.cursor-plugin/plugin.json', content: '{}' }]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await expect(installer.install(mockClient as never, PLUGIN_MANIFEST, 'project')).rejects.toThrow(
      /missing file: skills\/x\/SKILL.md/,
    );
  });

  it('transforms claude-native plugin rules when installing on cursor', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'cross-platform-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'claude',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'rules/style.mdc', dest: 'rules/style.mdc' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'rules/style.mdc',
          content: '---\ndescription: style\nalwaysApply: true\n---\nBe tidy.',
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    const rulePath = path.join(tmp, '.cursor', 'rules', 'style.mdc');
    expect(fs.existsSync(rulePath)).toBe(true);
    expect(fs.readFileSync(rulePath, 'utf8')).toContain('Be tidy.');
  });

  it('skips claude-native plugin hooks on cursor when transform cannot merge', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: 'cross-hook-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'claude',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'hooks/hooks.json', dest: 'hooks/hooks.json' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{}' },
        {
          path: 'hooks/hooks.json',
          content: JSON.stringify({
            hooks: { PreToolUse: [{ type: 'command', command: 'echo hi' }] },
          }),
        },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    const result = await installer.install(mockClient as never, PLUGIN_MANIFEST, 'project');

    expect(fs.existsSync(path.join(tmp, '.cursor', 'hooks.json'))).toBe(false);
    expect(result.fileResults.some((f) => f.skipped)).toBe(true);
  });
});

describe('Installer.getLock', () => {
  it('returns an empty lock when no lock file exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-installer-'));
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-installer-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-mcp-'));
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

  it('throws when existing mcp.json is malformed', async () => {
    const mcpPath = new ConfigManager(tmp).resolveMcpConfig('project');
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(mcpPath, '{ not valid json', 'utf8');

    await expect(installer.install(mockClient() as never, MCP_MANIFEST, 'project')).rejects.toThrow(
      /Failed to parse existing mcp.json/,
    );
  });

  it('installs http mcp servers when mcpServer.url is set', async () => {
    const httpManifest: ToolManifest = {
      ...MCP_MANIFEST,
      name: 'http-server',
      mcpServer: { url: 'https://mcp.example.com/sse', env: { API_KEY: 'x' } },
    };

    await installer.install(mockClient() as never, httpManifest, 'project');

    const mcpPath = new ConfigManager(tmp).resolveMcpConfig('project');
    const json = JSON.parse(fs.readFileSync(mcpPath, 'utf8')) as {
      servers: Record<string, { type: string; url: string; env?: Record<string, string> }>;
    };
    expect(json.servers['http-server']?.type).toBe('http');
    expect(json.servers['http-server']?.url).toBe('https://mcp.example.com/sse');
    expect(json.servers['http-server']?.env).toEqual({ API_KEY: 'x' });
  });
});

describe('Installer.uninstall (mcp-tool)', () => {
  let tmp: string;
  let installer: Installer;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-mcp-'));
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-platform-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
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
    expect(installed.files).toHaveLength(2);
    expect(installed.files.some((f) => f.endsWith('aitools.json'))).toBe(true);
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
    expect(installed.files).toHaveLength(2);
    expect(installed.files.some((f) => f.endsWith('aitools.json'))).toBe(true);
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-plat-guard-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('installs when manifest.platforms includes the active platform', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
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
      path.join(tmp, 'aitools.config.json'),
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
      path.join(tmp, 'aitools.config.json'),
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
      path.join(tmp, 'aitools.config.json'),
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

describe('Installer.install (cross-platform transformation)', () => {
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-transform-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'claude' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('transforms rule content when nativeFor differs from the active platform', async () => {
    const ruleContent = '---\nglobs: src/**\n---\n# Rule body';
    const manifest: ToolManifest = {
      name: 'my-rule',
      version: '1.0.0',
      description: 'A cursor rule',
      category: 'rule',
      nativeFor: 'cursor',
      files: [{ src: 'rule.mdc', dest: 'my-rule.mdc' }],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'rule.mdc', content: ruleContent }]),
      'utf8',
    );

    const result = await installer.install(makeClient(tarball) as never, manifest, 'project');

    expect(result.files).toHaveLength(2);
    expect(result.files.some((f) => f.endsWith('aitools.json'))).toBe(true);
    const written = fs.readFileSync(path.resolve(tmp, result.files[0]!), 'utf8');
    expect(written).toBe('# Rule body');
    expect(result.fileResults[0]?.transform?.confidence).toBe('medium');
  });

  it('skips agent install on windsurf when transformation is unsupported', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'windsurf' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));

    const manifest: ToolManifest = {
      name: 'my-agent',
      version: '1.0.0',
      description: 'A cursor agent',
      category: 'agent',
      nativeFor: 'cursor',
      files: [{ src: 'agent.md', dest: 'my-agent.md' }],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'agent.md', content: '---\nname: my-agent\n---\nBody' }]),
      'utf8',
    );

    const result = await installer.install(makeClient(tarball) as never, manifest, 'project');

    expect(result.files).toHaveLength(0);
    expect(result.fileResults[0]?.skipped).toBe(true);
  });
});

describe('Installer.install (hook category)', () => {
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-hook-'));
    cacheTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp, new CacheManager(cacheTmp));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(cacheTmp, { recursive: true });
  });

  it('merges hook config into .cursor/hooks.json', async () => {
    const hooksJson = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo hi' }],
    });
    const manifest: ToolManifest = {
      name: 'my-hooks',
      version: '1.0.0',
      description: 'Cursor hooks',
      category: 'hook',
      nativeFor: 'cursor',
      files: [{ src: 'hooks.json', dest: 'hooks.json' }],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'hooks.json', content: hooksJson }]),
      'utf8',
    );

    const result = await installer.install(makeClient(tarball) as never, manifest, 'project');

    const hooksPath = path.join(tmp, '.cursor', 'hooks.json');
    expect(fs.existsSync(hooksPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(hooksPath, 'utf8')) as Record<string, unknown[]>;
    expect(parsed.preToolUse).toHaveLength(1);
    expect(result.files[0]).toMatch(/\.cursor[\\/]hooks\.json$/);
  });

  it('merges new hook events into an existing hooks.json', async () => {
    const hooksDir = path.join(tmp, '.cursor');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(
      path.join(hooksDir, 'hooks.json'),
      JSON.stringify({ sessionStart: [{ type: 'command', command: 'echo start' }] }) + '\n',
      'utf8',
    );

    const incoming = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo tool' }],
    });
    const manifest: ToolManifest = {
      name: 'extra-hooks',
      version: '1.0.0',
      description: 'More hooks',
      category: 'hook',
      nativeFor: 'cursor',
      files: [{ src: 'hooks.json', dest: 'hooks.json' }],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'hooks.json', content: incoming }]),
      'utf8',
    );

    await installer.install(makeClient(tarball) as never, manifest, 'project');

    const parsed = JSON.parse(fs.readFileSync(path.join(hooksDir, 'hooks.json'), 'utf8')) as Record<string, unknown[]>;
    expect(parsed.sessionStart).toHaveLength(1);
    expect(parsed.preToolUse).toHaveLength(1);
  });

  it('skips claude-native hooks on cursor with an advisory message', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
    const claudeHooks = JSON.stringify({
      hooks: { PreToolUse: [{ type: 'command', command: 'echo hi' }] },
    });
    const manifest: ToolManifest = {
      name: 'claude-hooks',
      version: '1.0.0',
      description: 'Claude hooks',
      category: 'hook',
      nativeFor: 'claude',
      files: [{ src: 'settings.json', dest: 'settings.json' }],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'settings.json', content: claudeHooks }]),
      'utf8',
    );

    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const result = await installer.install(makeClient(tarball) as never, manifest, 'project');
    expect(result.fileResults.some((f) => f.skipped)).toBe(true);
    expect(stderrSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain('Advisory');
    stderrSpy.mockRestore();
  });

  it('throws when installing hooks on universal platform', async () => {
    installer = new Installer(new ConfigManager(tmp, { platform: 'universal' }), tmp, new CacheManager(cacheTmp));
    const manifest: ToolManifest = {
      name: 'universal-hooks',
      version: '1.0.0',
      description: 'Hooks',
      category: 'hook',
      nativeFor: 'cursor',
      files: [{ src: 'hooks.json', dest: 'hooks.json' }],
    };
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'hooks.json', content: '{}' }]),
      'utf8',
    );

    await expect(installer.install(makeClient(tarball) as never, manifest, 'project')).rejects.toThrow(
      /Hooks are not supported/,
    );
  });

  it('installs hooks from cache without downloading again', async () => {
    const cache = new CacheManager(cacheTmp);
    const manifest: ToolManifest = {
      name: 'cached-hooks',
      version: '1.0.0',
      description: 'Hooks',
      category: 'hook',
      nativeFor: 'cursor',
      files: [{ src: 'hooks.json', dest: 'hooks.json' }],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: 'hooks.json', content: JSON.stringify({ preToolUse: [{ command: 'echo cached' }] }) },
      ]),
      'utf8',
    );
    cache.store(manifest.name, manifest.version, tarball, manifest);
    installer = new Installer(new ConfigManager(tmp), tmp, cache);
    const mockDownload = jest.fn();
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: mockDownload,
    };

    await installer.install(mockClient as never, manifest, 'project');

    expect(mockDownload).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmp, '.cursor', 'hooks.json'))).toBe(true);
  });
});

describe('Installer user-scope tracking + cursor-plugin', () => {
  let tmp: string;
  let home: string;
  let installer: Installer;
  let homedirSpy: jest.SpyInstance;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-user-track-'));
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-user-home-'));
    process.env.AITOOLS_CONFIG_ROOT = home;
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(home);
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    installer = new Installer(new ConfigManager(tmp), tmp);
  });

  afterEach(() => {
    homedirSpy.mockRestore();
    delete process.env.AITOOLS_CONFIG_ROOT;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('writes user-scope lock under ~/.aitools, not the project', async () => {
    const tarball = Buffer.from(
      JSON.stringify([{ path: 'skill.md', content: '# Skill' }]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    await installer.install(mockClient as never, SKILL_MANIFEST, 'user');

    expect(fs.existsSync(path.join(tmp, 'aitools-lock.json'))).toBe(false);
    const userLock = path.join(home, '.aitools', 'aitools-lock.json');
    expect(fs.existsSync(userLock)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(userLock, 'utf8')) as {
      tools: Record<string, { scope?: string; files: string[] }>;
    };
    expect(lock.tools['my-skill']?.scope).toBe('user');
    expect(fs.existsSync(path.join(home, '.cursor', 'skills', 'skill.md'))).toBe(true);
  });

  it('installs --cursor-plugin as opaque tree under plugins/local', async () => {
    const PLUGIN_MANIFEST: ToolManifest = {
      name: '@team/my-plugin',
      version: '1.0.0',
      description: 'A plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/review/SKILL.md', dest: 'skills/review/SKILL.md' },
      ],
    };
    const tarball = Buffer.from(
      JSON.stringify([
        { path: '.cursor-plugin/plugin.json', content: '{"name":"my-plugin"}' },
        { path: 'skills/review/SKILL.md', content: '# Review' },
      ]),
      'utf8',
    );
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue({ data: tarball }),
    };

    const installed = await installer.install(mockClient as never, PLUGIN_MANIFEST, 'user', {
      cursorPlugin: true,
    });

    const localRoot = path.join(home, '.cursor', 'plugins', 'local', 'my-plugin');
    expect(fs.existsSync(path.join(localRoot, '.cursor-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(localRoot, 'skills', 'review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.cursor', 'skills', 'review', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'aitools-lock.json'))).toBe(false);
    expect(installed.installMethod).toBe('cursor-plugin-local');

    const userLock = JSON.parse(
      fs.readFileSync(path.join(home, '.aitools', 'aitools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { installMethod?: string }> };
    expect(userLock.tools['@team/my-plugin']?.installMethod).toBe('cursor-plugin-local');

    installer.uninstall('@team/my-plugin', 'user');
    expect(fs.existsSync(localRoot)).toBe(false);
  });

  it('rejects --cursor-plugin for non-plugin categories', async () => {
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn(),
    };
    await expect(
      installer.install(mockClient as never, SKILL_MANIFEST, 'user', { cursorPlugin: true }),
    ).rejects.toThrow(/requires category "plugin"/);
  });
});

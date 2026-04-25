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
      download: jest.fn().mockResolvedValue(tarball),
    };

    const installed = await installer.install(mockClient as never, SKILL_MANIFEST, 'project');

    expect(installed.name).toBe('my-skill');
    expect(installed.files).toHaveLength(1);
    expect(fs.existsSync(installed.files[0]!)).toBe(true);
    expect(installer.getLock().tools['my-skill']).toBeDefined();
  });

  it('throws when a file listed in the manifest is absent from the tarball', async () => {
    const tarball = Buffer.from(JSON.stringify([]), 'utf8');
    const mockClient = {
      config: { name: 'test-registry', url: 'https://test.example.com' },
      getManifest: jest.fn(),
      search: jest.fn(),
      download: jest.fn().mockResolvedValue(tarball),
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
      download: jest.fn().mockResolvedValue(tarball),
    };
    const installer = new Installer(new ConfigManager(tmp), tmp, cache);

    await installer.install(mockClient as never, SKILL_MANIFEST, 'project');

    expect(cache.has(SKILL_MANIFEST.name, SKILL_MANIFEST.version)).toBe(true);
  });
});

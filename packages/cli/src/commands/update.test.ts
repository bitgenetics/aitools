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
import { createUpdateCommand } from './update.js';
import { createRegistryClient } from '../utils/registry-client.js';
import { Installer } from '../utils/installer.js';
import { writeLockFile, upsertLockEntry, emptyLock } from '@bitgenetics/aitools-core';
import type { ToolManifest } from '@bitgenetics/aitools-core';

jest.mock('../utils/registry-client.js');
jest.mock('../utils/installer.js');

const MANIFEST: ToolManifest = {
  name: 'my-skill',
  version: '1.1.0',
  description: 'Updated skill',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'skill.md' }],
};

const mockGetManifest = jest.fn<Promise<ToolManifest>, [string, string?]>();
const mockListVersions = jest.fn<Promise<string[]>, [string]>();
const mockDownload = jest.fn<Promise<{ data: Buffer; integrity?: string }>, [string, string]>();
const mockClient = {
  getManifest: mockGetManifest,
  listVersions: mockListVersions,
  download: mockDownload,
};

beforeEach(() => {
  (createRegistryClient as jest.Mock).mockReturnValue(mockClient);
  mockGetManifest.mockResolvedValue(MANIFEST);
  mockListVersions.mockResolvedValue(['1.0.0', '1.1.0']);
  mockDownload.mockResolvedValue({ data: Buffer.alloc(0) });
  // Configure the auto-mocked Installer instance so getLock() returns a valid lock.
  (Installer as jest.Mock).mockImplementation(() => ({
    getLock: jest.fn().mockReturnValue(emptyLock()),
    install: jest.fn().mockResolvedValue(undefined),
    uninstall: jest.fn().mockReturnValue([]),
  }));
});

afterEach(() => jest.clearAllMocks());

describe('update command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-update-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ registries: [{ name: 'test', url: 'http://registry.example.com' }] }),
      'utf8',
    );
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
  });

  it('exits with 1 when no aitools.json is found', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });
    try {
      await expect(createUpdateCommand().parseAsync([], { from: 'user' })).rejects.toThrow('process.exit(1)');
    } finally {
      mockExit.mockRestore();
    }
  });

  it('prints a message when there are no tools to update', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify({ tools: {} }), 'utf8');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createUpdateCommand().parseAsync([], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output.toLowerCase()).toContain('no tools');
    logSpy.mockRestore();
  });

  it('reports zero updates when registry lookup fails', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify({ tools: { 'my-skill': '^1.0.0' } }), 'utf8');
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'my-skill', {
        version: '1.0.0',
        resolved: 'http://registry.example.com',
        integrity: 'sha256-abc=',
        files: [],
        installedAt: new Date().toISOString(),
      }),
    );
    mockListVersions.mockRejectedValue(new Error('registry down'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createUpdateCommand().parseAsync([], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('0 tool(s) updated');
    logSpy.mockRestore();
  });

  it('queries registry versions for each installed tool', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify({ tools: { 'my-skill': '^1.0.0' } }), 'utf8');
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'my-skill', {
        version: '1.0.0',
        resolved: 'http://registry.example.com',
        integrity: 'sha256-abc=',
        files: [],
        installedAt: new Date().toISOString(),
      }),
    );
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await createUpdateCommand().parseAsync([], { from: 'user' });
    expect(mockListVersions).toHaveBeenCalledWith('my-skill');
  });

  it('skips packages that are not listed in aitools.json', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify({ tools: { 'my-skill': '^1.0.0' } }), 'utf8');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createUpdateCommand().parseAsync(['ghost-skill'], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('not in aitools.json');
    logSpy.mockRestore();
  });

  it('exits when --global conflicts with --scope project', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });
    try {
      await expect(
        createUpdateCommand().parseAsync(['--global', '--scope', 'project'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)');
    } finally {
      mockExit.mockRestore();
    }
  });

  it('reads user tracking root with --global', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-update-home-'));
    const userRoot = path.join(home, '.aitools');
    fs.mkdirSync(userRoot, { recursive: true });
    fs.writeFileSync(path.join(userRoot, 'aitools.json'), JSON.stringify({ tools: {} }), 'utf8');
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(home);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await createUpdateCommand().parseAsync(['--global'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output.toLowerCase()).toContain('no tools');
    } finally {
      logSpy.mockRestore();
      homedirSpy.mockRestore();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

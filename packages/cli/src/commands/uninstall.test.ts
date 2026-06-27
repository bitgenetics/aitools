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
import { createUninstallCommand } from './uninstall.js';
import { writeLockFile, upsertLockEntry, emptyLock, readLockFile } from '@aitools/core';
import type { LockEntry } from '@aitools/core';

function makeLockEntry(files: string[]): LockEntry {
  return {
    version: '1.0.0',
    resolved: 'http://registry.example.com',
    integrity: 'sha256-abc=',
    files,
    installedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('uninstall command', () => {
  let tmp: string;
  const originalCwd = process.cwd();
  const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    throw new Error(`process.exit(${code})`);
  });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-uninstall-'));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
    jest.clearAllMocks();
  });

  afterAll(() => mockExit.mockRestore());

  it('removes installed files from the filesystem', () => {
    const installedFile = path.join(tmp, 'skill.md');
    fs.writeFileSync(installedFile, '# Skill', 'utf8');
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry([installedFile])));

    jest.spyOn(console, 'log').mockImplementation(() => {});
    createUninstallCommand().parse(['my-skill'], { from: 'user' });

    expect(fs.existsSync(installedFile)).toBe(false);
  });

  it('removes the tool from the lock file', () => {
    const installedFile = path.join(tmp, 'skill.md');
    fs.writeFileSync(installedFile, '# Skill', 'utf8');
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry([installedFile])));

    jest.spyOn(console, 'log').mockImplementation(() => {});
    createUninstallCommand().parse(['my-skill'], { from: 'user' });

    const lock = readLockFile(tmp);
    expect(lock.tools['my-skill']).toBeUndefined();
  });

  it('removes the tool from aitools.json when present', () => {
    const installedFile = path.join(tmp, 'skill.md');
    fs.writeFileSync(installedFile, '# Skill', 'utf8');
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry([installedFile])));
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify({ tools: { 'my-skill': '^1.0.0' } }), 'utf8');

    jest.spyOn(console, 'log').mockImplementation(() => {});
    createUninstallCommand().parse(['my-skill'], { from: 'user' });

    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as { tools: Record<string, string> };
    expect(manifest.tools['my-skill']).toBeUndefined();
  });

  it('exits with error when the tool is not installed', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => createUninstallCommand().parse(['ghost-tool'], { from: 'user' })).toThrow('process.exit(1)');
  });
});

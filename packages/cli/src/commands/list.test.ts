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
import { createListCommand } from './list.js';
import { writeLockFile, upsertLockEntry, emptyLock } from '@bitgenetics/aitools-core';
import type { LockEntry } from '@bitgenetics/aitools-core';

function makeLockEntry(overrides: Partial<LockEntry> = {}): LockEntry {
  return {
    version: '1.0.0',
    resolved: 'http://registry.example.com',
    integrity: 'sha256-abc=',
    files: ['/some/path/skill.md'],
    installedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('list command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-list-'));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
  });

  it('prints a message when no tools are installed', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      createListCommand().parse([], { from: 'user' });
      const output = spy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('No tools installed');
    } finally {
      spy.mockRestore();
    }
  });

  it('lists installed tools from the lock file', () => {
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry()));
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      createListCommand().parse([], { from: 'user' });
      const output = spy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('my-skill');
      expect(output).toContain('1.0.0');
    } finally {
      spy.mockRestore();
    }
  });

  it('outputs raw JSON with --json flag', () => {
    writeLockFile(tmp, upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry()));
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      createListCommand().parse(['--json'], { from: 'user' });
      const raw = spy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(raw) as { tools: Record<string, unknown> };
      expect(parsed.tools['my-skill']).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('lists user-scope tools with --global from ~/.aitools', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-list-home-'));
    const userRoot = path.join(home, '.aitools');
    fs.mkdirSync(userRoot, { recursive: true });
    writeLockFile(
      userRoot,
      upsertLockEntry(emptyLock(), 'user-skill', makeLockEntry({ installMethod: 'cursor-plugin-local' })),
    );
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(home);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      createListCommand().parse(['--global'], { from: 'user' });
      const output = spy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('user-skill');
      expect(output).toContain('[cursor-plugin]');
      expect(output).toContain('User-scope');
    } finally {
      spy.mockRestore();
      homedirSpy.mockRestore();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('shows [plugin-bundle] for plugin-bundle lock entries', () => {
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'bundled-skill', makeLockEntry({ installMethod: 'plugin-bundle' })),
    );
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      createListCommand().parse([], { from: 'user' });
      const output = spy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('bundled-skill');
      expect(output).toContain('[plugin-bundle]');
    } finally {
      spy.mockRestore();
    }
  });

  it('exits when --global conflicts with --scope project', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });
    try {
      expect(() => createListCommand().parse(['--global', '--scope', 'project'], { from: 'user' })).toThrow(
        'process.exit(1)',
      );
    } finally {
      errSpy.mockRestore();
      mockExit.mockRestore();
    }
  });

  it('prints user-scope empty hint with -g', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-list-empty-'));
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(home);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      createListCommand().parse(['-g'], { from: 'user' });
      const output = spy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('No user-scope tools installed');
    } finally {
      spy.mockRestore();
      homedirSpy.mockRestore();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

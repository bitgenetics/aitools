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
});

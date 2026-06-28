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
import {
  readLockFile,
  writeLockFile,
  upsertLockEntry,
  removeLockEntry,
  LOCK_FILENAME,
} from '../lock/lock-file.js';
import { emptyLock } from '../types/lock.js';
import type { LockEntry } from '../types/lock.js';

const FIXED_DATE = '2024-01-01T00:00:00.000Z';

function makeLockEntry(overrides: Partial<LockEntry> = {}): LockEntry {
  return {
    version: '1.0.0',
    resolved: 'https://registry.example.com/tarball',
    integrity: 'sha256-abc123=',
    files: ['/dest/tool.md'],
    installedAt: FIXED_DATE,
    ...overrides,
  };
}

describe('readLockFile', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-lock-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns an empty lock when no lock file exists', () => {
    expect(readLockFile(tmp)).toEqual({ lockfileVersion: 1, tools: {} });
  });

  it('throws when the lock file contains malformed JSON', () => {
    fs.writeFileSync(path.join(tmp, LOCK_FILENAME), 'bad json', 'utf8');
    expect(() => readLockFile(tmp)).toThrow('Failed to parse');
  });

  it('throws when the lock file fails schema validation', () => {
    fs.writeFileSync(
      path.join(tmp, LOCK_FILENAME),
      JSON.stringify({ lockfileVersion: 99, tools: {} }),
      'utf8',
    );
    expect(() => readLockFile(tmp)).toThrow('Invalid lock file');
  });

  it('round-trips a lock with entries through writeLockFile', () => {
    const lock = upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry());
    writeLockFile(tmp, lock);
    expect(readLockFile(tmp)).toEqual(lock);
  });
});

describe('upsertLockEntry', () => {
  it('adds a new entry and returns a new object without mutating the original', () => {
    const original = emptyLock();
    const updated = upsertLockEntry(original, 'my-skill', makeLockEntry());
    expect(updated.tools['my-skill']).toBeDefined();
    expect(original.tools['my-skill']).toBeUndefined();
  });

  it('overwrites an existing entry with the new version', () => {
    const lock = upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry({ version: '1.0.0' }));
    const updated = upsertLockEntry(lock, 'my-skill', makeLockEntry({ version: '2.0.0' }));
    expect(updated.tools['my-skill']?.version).toBe('2.0.0');
  });

  it('preserves other entries when adding a new one', () => {
    const lock = upsertLockEntry(emptyLock(), 'other-skill', makeLockEntry());
    const updated = upsertLockEntry(lock, 'my-skill', makeLockEntry());
    expect(updated.tools['other-skill']).toBeDefined();
    expect(updated.tools['my-skill']).toBeDefined();
  });
});

describe('removeLockEntry', () => {
  it('removes the named entry and returns a new object without mutating the original', () => {
    const lock = upsertLockEntry(emptyLock(), 'my-skill', makeLockEntry());
    const updated = removeLockEntry(lock, 'my-skill');
    expect(updated.tools['my-skill']).toBeUndefined();
    expect(lock.tools['my-skill']).toBeDefined();
  });

  it('returns an equivalent lock when the name is not present', () => {
    const lock = emptyLock();
    expect(removeLockEntry(lock, 'ghost')).toEqual(lock);
  });

  it('preserves other entries when removing one', () => {
    const lock = upsertLockEntry(
      upsertLockEntry(emptyLock(), 'skill-a', makeLockEntry()),
      'skill-b',
      makeLockEntry(),
    );
    const updated = removeLockEntry(lock, 'skill-a');
    expect(updated.tools['skill-b']).toBeDefined();
  });
});

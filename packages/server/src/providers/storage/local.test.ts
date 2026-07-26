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
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LocalStorageProvider } from './local.js';

describe('LocalStorageProvider', () => {
  let rootDir: string;
  let storage: LocalStorageProvider;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-storage-'));
    storage = new LocalStorageProvider(rootDir);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('writes and reads text files under the root directory', async () => {
    await storage.write('nested/file.txt', 'hello');
    expect(await storage.readText('nested/file.txt')).toBe('hello');
    expect(await storage.exists('nested/file.txt')).toBe(true);
  });

  it('returns false from exists for missing paths', async () => {
    expect(await storage.exists('missing.txt')).toBe(false);
  });

  it('returns an empty list for missing directories', async () => {
    expect(await storage.list('missing-dir')).toEqual([]);
  });

  it('rejects path traversal outside the root directory', async () => {
    await expect(storage.read('../outside.txt')).rejects.toThrow('Path traversal denied');
  });

  it('removes files and reports mtime after write', async () => {
    const beforeWrite = Date.now();
    await storage.write('remove-me.txt', 'x');
    const before = await storage.stat('remove-me.txt');
    // FS mtime can land slightly ahead of Date.now() on CI runners; allow 2s slack.
    expect(before.mtime.getTime()).toBeGreaterThanOrEqual(beforeWrite - 2000);
    expect(before.mtime.getTime()).toBeLessThanOrEqual(Date.now() + 2000);
    await storage.remove('remove-me.txt');
    expect(await storage.exists('remove-me.txt')).toBe(false);
  });
});

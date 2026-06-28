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
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { IStorageProvider, StorageEntry } from './types.js';

/**
 * Storage provider backed by the local filesystem.
 *
 * All paths are resolved relative to `rootDir`.
 * Suitable for local and dev deployment modes.
 */
export class LocalStorageProvider implements IStorageProvider {
  constructor(private readonly rootDir: string) {}

  private abs(p: string): string {
    // Prevent path traversal: resolve and ensure it stays within rootDir
    const resolved = path.resolve(this.rootDir, p);
    if (!resolved.startsWith(path.resolve(this.rootDir))) {
      throw new Error(`Path traversal denied: "${p}"`);
    }
    return resolved;
  }

  async read(p: string): Promise<Buffer> {
    return fsp.readFile(this.abs(p));
  }

  async readText(p: string): Promise<string> {
    return fsp.readFile(this.abs(p), 'utf-8');
  }

  async write(p: string, content: Buffer | string): Promise<void> {
    const abs = this.abs(p);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content);
  }

  async append(p: string, content: string): Promise<void> {
    const abs = this.abs(p);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.appendFile(abs, content);
  }

  async exists(p: string): Promise<boolean> {
    try {
      await fsp.access(this.abs(p));
      return true;
    } catch {
      return false;
    }
  }

  async list(p: string): Promise<StorageEntry[]> {
    const abs = this.abs(p);
    try {
      const entries = await fsp.readdir(abs, { withFileTypes: true });
      return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
    } catch {
      return [];
    }
  }

  async remove(p: string, opts?: { recursive?: boolean }): Promise<void> {
    const abs = this.abs(p);
    if (!fs.existsSync(abs)) return;
    await fsp.rm(abs, { recursive: opts?.recursive ?? false, force: true });
  }

  async stat(p: string): Promise<{ mtime: Date }> {
    const s = await fsp.stat(this.abs(p));
    return { mtime: s.mtime };
  }

  async ensureDir(p: string): Promise<void> {
    await fsp.mkdir(this.abs(p), { recursive: true });
  }
}

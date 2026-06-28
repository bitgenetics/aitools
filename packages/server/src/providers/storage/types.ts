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
/**
 * Storage provider abstraction.
 *
 * Implementations:
 *  - LocalStorageProvider  — direct filesystem (default; mode: local/dev)
 *  - AzureStorageProvider  — Azure Blob Storage (mode: production)
 *  - S3StorageProvider     — AWS S3 (mode: production)
 */

export interface StorageEntry {
  /** File or "directory" name within the listed path. */
  name: string;
  isDirectory: boolean;
}

export interface IStorageProvider {
  /** Read a file as a Buffer. Throws if the path does not exist. */
  read(path: string): Promise<Buffer>;
  /** Read a file as UTF-8 text. Throws if the path does not exist. */
  readText(path: string): Promise<string>;
  /** Write data to a path, creating parent directories as needed. */
  write(path: string, content: Buffer | string): Promise<void>;
  /** Append a line to a file, creating it if it does not exist. */
  append(path: string, content: string): Promise<void>;
  /** Return true if the path exists. */
  exists(path: string): Promise<boolean>;
  /**
   * List entries within a path.
   * Returns an empty array if the path does not exist.
   * Object-storage implementations may flatten nested keys into simulated directories.
   */
  list(path: string): Promise<StorageEntry[]>;
  /** Delete a path. Pass { recursive: true } to delete a non-empty directory/prefix. */
  remove(path: string, opts?: { recursive?: boolean }): Promise<void>;
  /** Return metadata for a path. Throws if the path does not exist. */
  stat(path: string): Promise<{ mtime: Date }>;
  /** Ensure a directory exists. No-op for object-storage providers. */
  ensureDir(path: string): Promise<void>;
}

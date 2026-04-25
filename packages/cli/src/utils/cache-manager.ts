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
import crypto from 'node:crypto';
import type { ToolManifest } from '@ai-tools/core';

/**
 * Manages the local tool cache at ~/.ai-tools/cache/.
 *
 * Each cached tool is stored at:
 *   <base>/<name>/<version>/.agents/<file.dest>   ← universal representation
 *   <base>/<name>/<version>/cache-metadata.json   ← integrity + timestamps
 *
 * The .agents/ sub-directory mirrors the tool's universal file layout so it
 * can be copied to any platform destination without re-downloading.
 *
 * Scoped package names (e.g. @scope/name) are stored as scope/name on disk.
 */

export interface CacheMetadata {
  name: string;
  version: string;
  integrity: string;
  cachedAt: string;
}

export interface CacheEntry {
  /** Absolute path to <base>/<name>/<version> */
  dir: string;
  /** Absolute path to <base>/<name>/<version>/.agents */
  agentsDir: string;
  integrity: string;
}

export class CacheManager {
  /** Root of the cache — exposed so callers can display or clean it. */
  readonly base: string;

  constructor(base: string = path.join(os.homedir(), '.ai-tools', 'cache')) {
    this.base = base;
  }

  // ── Paths ─────────────────────────────────────────────────────────────────

  /** Absolute path to the versioned cache entry directory. */
  entryDir(name: string, version: string): string {
    return path.join(this.base, safeName(name), version);
  }

  /** Absolute path to the .agents/ directory inside a cache entry. */
  agentsDir(name: string, version: string): string {
    return path.join(this.entryDir(name, version), '.agents');
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Returns true when a valid cache entry exists for this name + version. */
  has(name: string, version: string): boolean {
    return fs.existsSync(path.join(this.entryDir(name, version), 'cache-metadata.json'));
  }

  /**
   * Returns the stored metadata for a cached entry.
   * Throws if the entry is not present — call `has()` first.
   */
  getMetadata(name: string, version: string): CacheMetadata {
    const metaPath = path.join(this.entryDir(name, version), 'cache-metadata.json');
    if (!fs.existsSync(metaPath)) {
      throw new Error(`Cache entry not found for ${name}@${version}`);
    }
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as CacheMetadata;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Extract a tarball into the cache and write metadata.
   *
   * Files from the tarball are written to:
   *   <agentsDir>/<file.dest>
   *
   * Throws if any file listed in `manifest.files` is absent from the tarball.
   * When `expectedIntegrity` is provided, verifies the computed hash matches.
   */
  store(name: string, version: string, tarball: Buffer, manifest: ToolManifest, expectedIntegrity?: string): CacheEntry {
    const dir = this.entryDir(name, version);
    const agentsDir = path.join(dir, '.agents');
    const integrity = sha256(tarball);

    if (expectedIntegrity && integrity !== expectedIntegrity) {
      throw new Error(
        `Integrity check failed for ${name}@${version}.\n` +
        `  Expected: ${expectedIntegrity}\n` +
        `  Received: ${integrity}\n` +
        'The tarball may have been tampered with. Aborting install.',
      );
    }

    fs.mkdirSync(agentsDir, { recursive: true });

    const entries = parseTarball(tarball);

    for (const file of manifest.files) {
      const entry = entries.find((e) => e.path === file.src);
      if (!entry) {
        throw new Error(
          `Tarball for ${name}@${version} is missing file: ${file.src}`,
        );
      }
      // Store by src (unique per entry) so multi-platform files sharing
      // the same dest don't overwrite each other in the cache.
      const dest = path.join(agentsDir, file.src);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.content, 'utf8');
    }

    const metadata: CacheMetadata = {
      name,
      version,
      integrity,
      cachedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(dir, 'cache-metadata.json'),
      JSON.stringify(metadata, null, 2) + '\n',
      'utf8',
    );

    return { dir, agentsDir, integrity };
  }

  /**
   * Remove cached entries.
   * - `clear()` — clears the entire cache
   * - `clear(name)` — removes all versions of a tool
   * - `clear(name, version)` — removes one specific version
   */
  clear(name?: string, version?: string): void {
    const target =
      name && version
        ? path.join(this.base, safeName(name), version)
        : name
          ? path.join(this.base, safeName(name))
          : this.base;

    fs.rmSync(target, { recursive: true, force: true });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function sha256(buf: Buffer): string {
  return 'sha256-' + crypto.createHash('sha256').update(buf).digest('base64');
}

/**
 * Convert a package name to a safe filesystem path segment.
 * @scope/name → scope/name  (removes leading @)
 */
function safeName(name: string): string {
  return name.replace(/^@/, '');
}

interface TarEntry {
  path: string;
  content: string;
}

function parseTarball(buf: Buffer): TarEntry[] {
  const parsed: unknown = JSON.parse(buf.toString('utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Unexpected tarball format: expected JSON array');
  }
  return parsed as TarEntry[];
}

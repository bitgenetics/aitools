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
import path from 'node:path';
import crypto from 'node:crypto';
import semver from 'semver';
import type { ToolManifest } from '@ai-tools/core';
import type { IStorageProvider } from '../providers/storage/types.js';
import { LocalStorageProvider } from '../providers/storage/local.js';

export interface StoredTool {
  manifest: ToolManifest;
  /** Map of file path → file content (used to serve tarballs). */
  files: Record<string, string>;
  publishedAt: string;
}

export interface PublishActor {
  userId: string;
  org: string;
}

export interface ToolOwnerMetadata {
  org: string;
  createdBy: string;
  createdAt: string;
  /** When set, overrides the per-version manifest `private` field for all versions. */
  private?: boolean;
}

export class ToolStoreError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ToolStoreError';
  }
}

/**
 * Tool store backed by an IStorageProvider.
 *
 * Layout: <root>/<name>/<version>/manifest.json
 *                                /files.json
 *         <root>/<name>/owner.json
 *
 * Accepts either a dataDir string (convenience; creates a LocalStorageProvider)
 * or an IStorageProvider directly (allows filesystem, Azure, S3, etc.).
 */
export class ToolStore {
  private readonly provider: IStorageProvider;

  constructor(providerOrDataDir: IStorageProvider | string) {
    this.provider =
      typeof providerOrDataDir === 'string'
        ? new LocalStorageProvider(providerOrDataDir)
        : providerOrDataDir;
  }

  /** Persist a new tool version. Throws if it already exists. */
  async publish(
    manifest: ToolManifest,
    files: Record<string, string>,
    publisher?: PublishActor,
  ): Promise<void> {
    const dir = this.versionPath(manifest.name, manifest.version);

    if (await this.provider.exists(path.join(dir, 'manifest.json'))) {
      throw new Error(`${manifest.name}@${manifest.version} already published`);
    }

    const existingOwner = await this.getOwner(manifest.name);
    const hasPublishedVersions = (await this.listVersions(manifest.name)).length > 0;

    if (existingOwner) {
      if (!publisher) {
        throw new ToolStoreError(
          `Authentication required to publish "${manifest.name}"`,
          401,
        );
      }
      if (publisher.org !== existingOwner.org) {
        throw new ToolStoreError(
          `Forbidden: tool "${manifest.name}" is owned by org "${existingOwner.org}"`,
          403,
        );
      }
    } else if (publisher) {
      if (hasPublishedVersions) {
        throw new ToolStoreError(
          `Ownership metadata missing for existing tool "${manifest.name}". Configure owner metadata before publishing.`,
          409,
        );
      }
      await this.writeOwner(manifest.name, {
        org: publisher.org,
        createdBy: publisher.userId,
        createdAt: new Date().toISOString(),
      });
    }

    await this.provider.write(
      path.join(dir, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    await this.provider.write(
      path.join(dir, 'files.json'),
      JSON.stringify(files, null, 2) + '\n',
    );
  }

  /** Retrieve owner metadata for a tool, if any. */
  async getOwner(name: string): Promise<ToolOwnerMetadata | null> {
    const ownerPath = this.ownerFilePath(name);
    if (!(await this.provider.exists(ownerPath))) return null;

    const parsed = JSON.parse(await this.provider.readText(ownerPath)) as Partial<ToolOwnerMetadata>;
    if (
      !parsed
      || typeof parsed.org !== 'string'
      || typeof parsed.createdBy !== 'string'
      || typeof parsed.createdAt !== 'string'
    ) {
      throw new Error(`Invalid owner metadata for tool "${name}"`);
    }

    return {
      org: parsed.org,
      createdBy: parsed.createdBy,
      createdAt: parsed.createdAt,
      private: typeof parsed.private === 'boolean' ? parsed.private : undefined,
    };
  }

  /**
   * Set the tool-level privacy flag. Only the owning org may call this.
   * The owner-level flag takes precedence over the per-version manifest `private` field.
   */
  async setPrivacy(name: string, isPrivate: boolean, actor: PublishActor): Promise<void> {
    const owner = await this.getOwner(name);
    if (!owner) {
      throw new ToolStoreError(`Tool "${name}" not found`, 404);
    }
    if (actor.org !== owner.org) {
      throw new ToolStoreError(
        `Forbidden: tool "${name}" is owned by org "${owner.org}"`,
        403,
      );
    }
    await this.writeOwner(name, { ...owner, private: isPrivate });
  }

  /** Retrieve a specific version or "latest". */
  async get(name: string, version: string): Promise<StoredTool | null> {
    const resolvedVersion = version === 'latest' ? await this.resolveLatest(name) : version;
    if (!resolvedVersion) return null;

    const dir = this.versionPath(name, resolvedVersion);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!(await this.provider.exists(manifestPath))) return null;

    const manifest = JSON.parse(await this.provider.readText(manifestPath)) as ToolManifest;
    const files = JSON.parse(
      await this.provider.readText(path.join(dir, 'files.json')),
    ) as Record<string, string>;

    const { mtime } = await this.provider.stat(manifestPath);

    // Owner-level privacy overrides the per-version manifest field.
    const owner = await this.getOwner(name);
    const effectiveManifest: ToolManifest =
      owner?.private !== undefined ? { ...manifest, private: owner.private } : manifest;

    return { manifest: effectiveManifest, files, publishedAt: mtime.toISOString() };
  }

  /** List all versions of a tool, sorted newest first. */
  async listVersions(name: string): Promise<string[]> {
    const entries = await this.provider.list(this.toolPath(name));
    return entries
      .map((e) => e.name)
      .filter((v) => semver.valid(v) !== null)
      .sort(semver.rcompare);
  }

  /** Search all published tools by name, description, keywords, tags. */
  async search(query: string): Promise<ToolManifest[]> {
    const term = query.startsWith('__smart__:')
      ? query.slice('__smart__:'.length).toLowerCase()
      : query.toLowerCase();

    const results: ToolManifest[] = [];
    const toolDirs = await this.provider.list('');

    for (const entry of toolDirs) {
      if (!entry.isDirectory) continue;
      const latest = await this.resolveLatest(entry.name);
      if (!latest) continue;

      const stored = await this.get(entry.name, latest);
      if (!stored) continue;

      // get() already merges owner-level privacy, so manifest here is authoritative.
      const { manifest } = stored;
      const haystack = [
        manifest.name,
        manifest.description,
        manifest.category,
        ...(manifest.keywords ?? []),
        ...(manifest.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();

      if (!term || haystack.includes(term)) {
        results.push(manifest);
      }
    }

    return results;
  }

  /** Build a simple JSON "tarball" (array of {path, content} entries). */
  async buildTarball(name: string, version: string): Promise<Buffer> {
    const stored = await this.get(name, version);
    if (!stored) throw new Error(`Not found: ${name}@${version}`);

    const entries = Object.entries(stored.files).map(([filePath, content]) => ({
      path: filePath,
      content,
    }));

    return Buffer.from(JSON.stringify(entries), 'utf8');
  }

  /** Compute SHA-256 integrity hash of the tarball. */
  async integrity(name: string, version: string): Promise<string> {
    const buf = await this.buildTarball(name, version);
    return 'sha256-' + crypto.createHash('sha256').update(buf).digest('base64');
  }

  /** Mark a tool version as deprecated. */
  async deprecate(name: string, version: string): Promise<void> {
    const versionDir = this.versionPath(name, version);
    if (!(await this.provider.exists(path.join(versionDir, 'manifest.json')))) {
      throw new Error(`Version not found: ${name}@${version}`);
    }
    await this.provider.write(
      path.join(versionDir, 'deprecated.json'),
      JSON.stringify({ deprecatedAt: new Date().toISOString() }, null, 2) + '\n',
    );
  }

  /** Remove a specific version of a tool. */
  async unpublish(name: string, version: string): Promise<void> {
    const versionDir = this.versionPath(name, version);
    if (!(await this.provider.exists(path.join(versionDir, 'manifest.json')))) {
      throw new Error(`Version not found: ${name}@${version}`);
    }

    await this.provider.remove(versionDir, { recursive: true });

    const remaining = await this.listVersions(name);
    if (remaining.length === 0) {
      await this.provider.remove(this.toolPath(name), { recursive: true });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private toolPath(name: string): string {
    return sanitizeName(name);
  }

  private versionPath(name: string, version: string): string {
    return path.join(this.toolPath(name), version);
  }

  private async resolveLatest(name: string): Promise<string | null> {
    const versions = await this.listVersions(name);
    return versions[0] ?? null;
  }

  private ownerFilePath(name: string): string {
    return path.join(this.toolPath(name), 'owner.json');
  }

  private async writeOwner(name: string, owner: ToolOwnerMetadata): Promise<void> {
    await this.provider.write(this.ownerFilePath(name), JSON.stringify(owner, null, 2) + '\n');
  }
}

/**
 * Convert a scoped package name like "@scope/name" to a safe directory name.
 * "@scope/name" → "@scope__name"
 */
function sanitizeName(name: string): string {
  return name.replace('/', '__');
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ToolManifest } from '@ai-tools/core';
import { ToolManifestSchema } from '@ai-tools/core';

export interface StoredTool {
  manifest: ToolManifest;
  /** Map of file path → file content (used to serve tarballs). */
  files: Record<string, string>;
  publishedAt: string;
}

/**
 * File-based tool store.
 * Layout: <dataDir>/<name>/<version>/manifest.json + files/
 *
 * Suitable for development and small registries.
 * Replace with a database-backed implementation for production scale.
 */
export class ToolStore {
  constructor(private readonly dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  /** Persist a new tool version. Throws if it already exists. */
  publish(manifest: ToolManifest, files: Record<string, string>): void {
    const dir = this.versionDir(manifest.name, manifest.version);
    if (fs.existsSync(dir)) {
      throw new Error(`${manifest.name}@${manifest.version} already published`);
    }
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    fs.writeFileSync(
      path.join(dir, 'files.json'),
      JSON.stringify(files, null, 2) + '\n',
    );
  }

  /** Retrieve a specific version or "latest". */
  get(name: string, version: string): StoredTool | null {
    const resolvedVersion = version === 'latest' ? this.resolveLatest(name) : version;
    if (!resolvedVersion) return null;

    const dir = this.versionDir(name, resolvedVersion);
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) return null;

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'),
    ) as ToolManifest;

    const files = JSON.parse(
      fs.readFileSync(path.join(dir, 'files.json'), 'utf8'),
    ) as Record<string, string>;

    return {
      manifest,
      files,
      publishedAt: fs.statSync(path.join(dir, 'manifest.json')).mtime.toISOString(),
    };
  }

  /** List all versions of a tool, sorted newest first. */
  listVersions(name: string): string[] {
    const toolDir = path.join(this.dataDir, sanitizeName(name));
    if (!fs.existsSync(toolDir)) return [];
    return fs
      .readdirSync(toolDir)
      .filter((d) => fs.statSync(path.join(toolDir, d)).isDirectory())
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }

  /** Search all published tools by name, description, keywords, tags. */
  search(query: string): ToolManifest[] {
    const smartPrefix = '__smart__:';
    const isSmartSearch = query.startsWith(smartPrefix);
    const term = isSmartSearch
      ? query.slice(smartPrefix.length).toLowerCase()
      : query.toLowerCase();

    const results: ToolManifest[] = [];

    const toolDirs = fs.existsSync(this.dataDir)
      ? fs.readdirSync(this.dataDir)
      : [];

    for (const toolDir of toolDirs) {
      const latest = this.resolveLatest(toolDir);
      if (!latest) continue;

      const stored = this.get(toolDir, latest);
      if (!stored) continue;

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

      if (haystack.includes(term)) {
        results.push(manifest);
      }
    }

    return results;
  }

  /** Build a simple JSON "tarball" (array of {path, content} entries). */
  buildTarball(name: string, version: string): Buffer {
    const stored = this.get(name, version);
    if (!stored) throw new Error(`Not found: ${name}@${version}`);

    const entries = Object.entries(stored.files).map(([filePath, content]) => ({
      path: filePath,
      content,
    }));

    return Buffer.from(JSON.stringify(entries), 'utf8');
  }

  /** Compute SHA-256 integrity hash of the tarball. */
  integrity(name: string, version: string): string {
    const buf = this.buildTarball(name, version);
    return 'sha256-' + crypto.createHash('sha256').update(buf).digest('base64');
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private versionDir(name: string, version: string): string {
    return path.join(this.dataDir, sanitizeName(name), version);
  }

  private resolveLatest(name: string): string | null {
    const versions = this.listVersions(name);
    return versions[0] ?? null;
  }
}

/**
 * Convert a scoped package name like "@scope/name" to a safe directory name.
 * "@scope/name" → "@scope__name"
 */
function sanitizeName(name: string): string {
  return name.replace('/', '__');
}

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
import path from 'node:path';
import type { AiToolsManifest } from '../types/config.js';
import { AitoolsJsonSchema } from '../schema/config-schema.js';
import {
  MANIFEST_FILENAME,
  LEGACY_PUBLISH_MANIFEST_FILENAME,
} from './manifest-constants.js';

export {
  MANIFEST_FILENAME,
  LEGACY_PUBLISH_MANIFEST_FILENAME,
  REGISTRY_MANIFEST_FILENAME,
  LEGACY_REGISTRY_MANIFEST_FILENAME,
} from './manifest-constants.js';

export interface ReadManifestOptions {
  /** Emit deprecation warnings to stderr when legacy keys or files are used. */
  warn?: (message: string) => void;
}

function detectLegacyDepKeys(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return 'tools' in obj || 'devTools' in obj;
}

/**
 * Read an aitools.json manifest from a directory.
 * Returns null if the file does not exist.
 */
export function readManifest(dir: string, options?: ReadManifestOptions): AiToolsManifest | null {
  const filePath = path.join(dir, MANIFEST_FILENAME);
  if (!fs.existsSync(filePath)) return null;

  const rawText = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${(err as Error).message}`);
  }

  if (detectLegacyDepKeys(parsed) && options?.warn) {
    options.warn(
      '[aitools] Deprecated: aitools.json uses "tools"/"devTools". Rename to "dependencies"/"devDependencies".',
    );
  }

  const result = AitoolsJsonSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid manifest at ${filePath}: ${result.error.message}`);
  }
  return result.data;
}

/** Alias for readManifest. */
export const readAitoolsJson = readManifest;

/**
 * Write an aitools.json manifest to disk.
 */
export function writeManifest(dir: string, manifest: AiToolsManifest): void {
  const filePath = path.join(dir, MANIFEST_FILENAME);
  const content = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Add or update a registry dependency in the manifest. */
export function upsertDependency(
  manifest: AiToolsManifest,
  name: string,
  version: string,
  dev = false,
): AiToolsManifest {
  if (dev) {
    const dependencies = { ...(manifest.dependencies ?? {}) };
    delete dependencies[name];
    return {
      ...manifest,
      dependencies,
      devDependencies: { ...(manifest.devDependencies ?? {}), [name]: version },
    };
  }
  const devDependencies = { ...(manifest.devDependencies ?? {}) };
  delete devDependencies[name];
  return {
    ...manifest,
    dependencies: { ...(manifest.dependencies ?? {}), [name]: version },
    devDependencies,
  };
}

/** @deprecated Use upsertDependency */
export const upsertToolDependency = upsertDependency;

/** Remove a registry dependency from the manifest. */
export function removeDependency(manifest: AiToolsManifest, name: string): AiToolsManifest {
  const dependencies = { ...(manifest.dependencies ?? {}) };
  const devDependencies = { ...(manifest.devDependencies ?? {}) };
  delete dependencies[name];
  delete devDependencies[name];
  return { ...manifest, dependencies, devDependencies };
}

/** @deprecated Use removeDependency */
export const removeToolDependency = removeDependency;

export interface ResolvedPublishSource {
  manifestDir: string;
  unified: AiToolsManifest;
}

function rejectLegacyPublishManifest(): never {
  throw new Error(
    `${LEGACY_PUBLISH_MANIFEST_FILENAME} is no longer supported. Run: aitools manifest migrate`,
  );
}

/**
 * Resolve the publish manifest source directory and document from aitools.json.
 */
export function resolvePublishSource(
  cwd: string,
  explicitPath?: string,
  warn?: (message: string) => void,
): ResolvedPublishSource | null {
  if (explicitPath) {
    const manifestPath = path.resolve(explicitPath);
    const manifestDir = path.dirname(manifestPath);
    if (!fs.existsSync(manifestPath)) return null;
    if (path.basename(manifestPath) === LEGACY_PUBLISH_MANIFEST_FILENAME) {
      rejectLegacyPublishManifest();
    }
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
    const parsed = AitoolsJsonSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid manifest at ${manifestPath}: ${parsed.error.message}`);
    }
    return { manifestDir, unified: parsed.data };
  }

  const unifiedPath = path.join(cwd, MANIFEST_FILENAME);
  if (fs.existsSync(unifiedPath)) {
    const doc = readManifest(cwd, { warn });
    return doc ? { manifestDir: cwd, unified: doc } : null;
  }

  const legacyPath = path.join(cwd, LEGACY_PUBLISH_MANIFEST_FILENAME);
  if (fs.existsSync(legacyPath)) {
    rejectLegacyPublishManifest();
  }

  return null;
}

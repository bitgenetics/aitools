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
import semver from 'semver';
import {
  MANIFEST_FILENAME,
  LEGACY_PUBLISH_MANIFEST_FILENAME,
  readManifest,
  writeManifest,
  isPublishable,
} from '@bitgenetics/aitools-core';
import type { AiToolsManifest } from '@bitgenetics/aitools-core';

export type BumpType = 'major' | 'minor' | 'patch';

export const BUMP_TYPES: readonly BumpType[] = ['major', 'minor', 'patch'] as const;

export type ResolveNextVersionResult =
  | { ok: true; next: string }
  | { ok: false; error: string };

/**
 * Compute the next semver from a release type (`major`|`minor`|`patch`) or an
 * explicit version string. Explicit versions must be greater than current.
 */
export function resolveNextVersion(current: string, release: string): ResolveNextVersionResult {
  if (!semver.valid(current)) {
    return { ok: false, error: `Current version "${current}" is not a valid semver string.` };
  }

  if ((BUMP_TYPES as readonly string[]).includes(release)) {
    const next = semver.inc(current, release as BumpType);
    if (!next) {
      return { ok: false, error: 'Could not compute next version.' };
    }
    return { ok: true, next };
  }

  if (semver.valid(release)) {
    if (semver.lte(release, current)) {
      return {
        ok: false,
        error: `New version "${release}" must be greater than current "${current}".`,
      };
    }
    const next = semver.clean(release);
    if (!next) {
      return { ok: false, error: 'Could not compute next version.' };
    }
    return { ok: true, next };
  }

  return {
    ok: false,
    error: `Invalid release argument "${release}". Use: patch | minor | major | <x.y.z>`,
  };
}

export type LoadPublishManifestResult =
  | { ok: true; doc: AiToolsManifest }
  | { ok: false; error: string };

/** Load a publishable aitools.json from cwd (same rules as `manifest bump`). */
export function loadPublishManifest(cwd: string): LoadPublishManifestResult {
  const unifiedPath = path.join(cwd, MANIFEST_FILENAME);
  const legacyPath = path.join(cwd, LEGACY_PUBLISH_MANIFEST_FILENAME);

  if (fs.existsSync(unifiedPath)) {
    let doc: AiToolsManifest | null;
    try {
      doc = readManifest(cwd);
    } catch {
      return { ok: false, error: `Failed to parse ${MANIFEST_FILENAME}` };
    }
    if (!doc || !isPublishable(doc)) {
      return {
        ok: false,
        error: `${MANIFEST_FILENAME} has no publish fields. Run: aitools manifest init`,
      };
    }
    return { ok: true, doc };
  }

  if (fs.existsSync(legacyPath)) {
    return {
      ok: false,
      error: `${LEGACY_PUBLISH_MANIFEST_FILENAME} is no longer supported. Run: aitools manifest migrate`,
    };
  }

  return {
    ok: false,
    error: `No ${MANIFEST_FILENAME} found. Run: aitools manifest init`,
  };
}

export type BumpManifestVersionResult =
  | { ok: true; previous: string; next: string }
  | { ok: false; error: string };

/** Bump or set the version field in cwd's aitools.json and write it back. */
export function bumpManifestVersion(cwd: string, release: string): BumpManifestVersionResult {
  const loaded = loadPublishManifest(cwd);
  if (!loaded.ok) return loaded;

  const previous = loaded.doc.version ?? '';
  const resolved = resolveNextVersion(previous, release);
  if (!resolved.ok) return resolved;

  writeManifest(cwd, { ...loaded.doc, version: resolved.next });
  return { ok: true, previous, next: resolved.next };
}

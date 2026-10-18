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
import type { ToolFile, ToolManifest } from '../types/tool.js';
import type { ContextScope } from './types.js';
import { toProjectRel } from './ignore-glob.js';
import { readSnapshotManifest, snapshotFileAbs, type SnapshotSource } from './snapshot.js';
import type { ContextStore, ListedSnapshot } from './store.js';
import { assertCatalogPath } from './working-tree.js';

export const CONTEXT_PROFILE_CATEGORY = 'context-profile';

export class NotContextProfileError extends Error {
  constructor(name: string, category: string | undefined) {
    super(`Package ${name} has category "${category ?? 'none'}"; expected "${CONTEXT_PROFILE_CATEGORY}".`);
    this.name = 'NotContextProfileError';
  }
}

export interface ImportPackageOptions {
  /** Unpacked package directory (the registry cache's agents dir). */
  agentsDir: string;
  manifest: ToolManifest;
  registry: string;
  /** Defaults to `defaultLabelForPackage(manifest.name)`. */
  label?: string;
  scope: ContextScope;
}

/** `@org/auditor-profile` → `auditor-profile`; `org/x` → `org-x`. */
export function defaultLabelForPackage(name: string): string {
  return name.replace(/^@[^/]+\//, '').replace(/\//g, '-').toLowerCase();
}

/**
 * Registry `context-profile` → local snapshot. Every `dest` must be a contained AI-mech path,
 * checked before any write. Never switches.
 */
export function importSnapshotFromPackage(store: ContextStore, options: ImportPackageOptions): ListedSnapshot {
  const { manifest } = options;
  if (manifest.category !== CONTEXT_PROFILE_CATEGORY) {
    throw new NotContextProfileError(manifest.name, manifest.category);
  }
  const sources: SnapshotSource[] = [];
  for (const file of manifest.files as ToolFile[]) {
    const rel = toProjectRel(file.dest);
    assertCatalogPath(store.projectRoot, rel);
    const srcAbs = path.join(options.agentsDir, file.src);
    if (!fs.existsSync(srcAbs)) throw new Error(`${manifest.name} is missing packaged file ${file.src}`);
    sources.push({ path: rel, srcAbs });
  }
  const label = options.label ?? defaultLabelForPackage(manifest.name);
  return store.writeNamed(label, options.scope, sources, {
    package: manifest.name,
    version: manifest.version,
    registry: options.registry,
  });
}

export interface PublishPayload {
  manifest: ToolManifest;
  files: Record<string, string>;
}

export interface SnapshotPublishMeta {
  name: string;
  version: string;
  description?: string;
}

/** Local snapshot → publishable `context-profile` package (files keyed by their project-relative path). */
export function snapshotToPublishPayload(store: ContextStore, label: string, meta: SnapshotPublishMeta): PublishPayload {
  const ref = store.require(label);
  const snapshot = readSnapshotManifest(ref.dir);
  const files: Record<string, string> = {};
  const fileEntries: ToolFile[] = [];
  for (const file of snapshot.files) {
    files[file.path] = fs.readFileSync(snapshotFileAbs(ref.dir, file.path), 'utf8');
    fileEntries.push({ src: file.path, dest: file.path, placementMode: 'verbatim' });
  }
  return {
    manifest: {
      name: meta.name,
      version: meta.version,
      description: meta.description ?? `AI context snapshot "${label}"`,
      category: CONTEXT_PROFILE_CATEGORY,
      files: fileEntries,
    },
    files,
  };
}

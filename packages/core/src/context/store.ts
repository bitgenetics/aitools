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
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAitoolsJson } from '../manifest/manifest-file.js';
import type { AitoolsJson } from '../types/config.js';
import type { Catalog, ContextScope, ContextState, SnapshotManifest, SnapshotRef } from './types.js';
import { buildCatalog } from './catalog.js';
import { normalizeGlobList } from './ignore-glob.js';
import {
  STASH_DIR,
  STATE_FILE,
  contextRoot,
  ensureProjectContextRoot,
  snapshotDir,
  stashRoot,
} from './paths.js';
import { readSnapshotManifest, removeSnapshot, snapshotExists, writeSnapshot, type SnapshotSource } from './snapshot.js';
import { readState, writeState } from './state.js';

export const LABEL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
/** Names that collide with store layout files. */
const RESERVED_LABELS = new Set([STASH_DIR, STATE_FILE]);
const SCOPE_RESOLUTION_ORDER: readonly ContextScope[] = ['project', 'user'];

export class InvalidLabelError extends Error {
  constructor(label: string) {
    super(`Invalid snapshot label "${label}": use lowercase letters, digits, ".", "_" or "-" (max 64 chars; "${STASH_DIR}" is reserved).`);
    this.name = 'InvalidLabelError';
  }
}

export class UnknownLabelError extends Error {
  constructor(label: string) {
    super(`No snapshot named "${label}" in project or user scope. Run "aitools context list".`);
    this.name = 'UnknownLabelError';
  }
}

export class LabelExistsError extends Error {
  constructor(label: string, scope: ContextScope) {
    super(`A ${scope} snapshot named "${label}" already exists.`);
    this.name = 'LabelExistsError';
  }
}

export class ActiveSnapshotError extends Error {
  constructor(label: string) {
    super(`"${label}" is the active snapshot. Switch away first or pass --force.`);
    this.name = 'ActiveSnapshotError';
  }
}

export interface ContextStoreOptions {
  projectRoot: string;
  /**
   * Base directory for user-scope snapshots; the store lives at `<userRoot>/.aitools/context`,
   * the same `.aitools` tracking root the installer uses. Defaults to the home directory.
   */
  userRoot?: string;
  /** Defaults to `context.ignore` from the project's aitools.json. */
  ignore?: readonly string[];
}

export interface ListedSnapshot {
  ref: SnapshotRef;
  manifest: SnapshotManifest;
}

export interface StashEntry {
  dir: string;
  manifest: SnapshotManifest;
}

export function readContextIgnore(projectRoot: string): string[] {
  const manifest = readAitoolsJson(projectRoot) as AitoolsJson | null;
  return normalizeGlobList(manifest?.context?.ignore ?? []);
}

export function assertValidLabel(label: string): void {
  if (!LABEL_PATTERN.test(label) || RESERVED_LABELS.has(label)) throw new InvalidLabelError(label);
}

function stashEntryName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
}

/**
 * Snapshot storage for one project: named snapshots in two scopes (project shadows user),
 * the project-local stash stack, and the project-local active state. Storage only;
 * operations.ts owns the safety rules for changing the working tree.
 */
export class ContextStore {
  readonly projectRoot: string;
  readonly userRoot: string;
  readonly ignore: readonly string[];

  constructor(options: ContextStoreOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.userRoot = path.resolve(options.userRoot ?? os.homedir());
    this.ignore = options.ignore ?? readContextIgnore(this.projectRoot);
  }

  catalog(): Catalog {
    return buildCatalog(this.projectRoot, this.ignore);
  }

  readState(): ContextState {
    return readState(this.projectRoot);
  }

  writeState(state: ContextState): void {
    writeState(this.projectRoot, state);
  }

  private scopeBase(scope: ContextScope): string {
    return scope === 'project' ? this.projectRoot : this.userRoot;
  }

  refFor(label: string, scope: ContextScope): SnapshotRef {
    assertValidLabel(label);
    return { label, scope, dir: snapshotDir(this.scopeBase(scope), label) };
  }

  /** Project scope first, then user scope. Null when neither has the label. */
  resolve(label: string): SnapshotRef | null {
    for (const scope of SCOPE_RESOLUTION_ORDER) {
      const ref = this.refFor(label, scope);
      if (snapshotExists(ref.dir)) return ref;
    }
    return null;
  }

  require(label: string): SnapshotRef {
    const ref = this.resolve(label);
    if (!ref) throw new UnknownLabelError(label);
    return ref;
  }

  list(): ListedSnapshot[] {
    const out: ListedSnapshot[] = [];
    for (const scope of SCOPE_RESOLUTION_ORDER) {
      const root = contextRoot(this.scopeBase(scope));
      if (!fs.existsSync(root)) continue;
      for (const name of fs.readdirSync(root).sort((a, b) => a.localeCompare(b))) {
        if (!LABEL_PATTERN.test(name) || RESERVED_LABELS.has(name)) continue;
        const dir = path.join(root, name);
        if (!snapshotExists(dir)) continue;
        out.push({ ref: { label: name, scope, dir }, manifest: readSnapshotManifest(dir) });
      }
    }
    return out;
  }

  /** Write a named snapshot from arbitrary sources (working tree or an unpacked package). */
  writeNamed(label: string, scope: ContextScope, sources: SnapshotSource[], origin?: SnapshotManifest['origin']): ListedSnapshot {
    const ref = this.refFor(label, scope);
    if (scope === 'project') ensureProjectContextRoot(this.projectRoot);
    const manifest = writeSnapshot(ref.dir, sources, { label, ...(origin ? { origin } : {}) });
    return { ref, manifest };
  }

  drop(label: string, options: { force?: boolean } = {}): SnapshotRef {
    const ref = this.require(label);
    const state = this.readState();
    if (state.active === label && !options.force) throw new ActiveSnapshotError(label);
    removeSnapshot(ref.dir);
    if (state.active === label) this.writeState({ ...state, active: null, scope: null });
    return ref;
  }

  rename(from: string, to: string): SnapshotRef {
    const src = this.require(from);
    const dest = this.refFor(to, src.scope);
    if (snapshotExists(dest.dir)) throw new LabelExistsError(to, src.scope);
    fs.renameSync(src.dir, dest.dir);
    const manifest = readSnapshotManifest(dest.dir);
    fs.writeFileSync(path.join(dest.dir, 'manifest.json'), JSON.stringify({ ...manifest, label: to }, null, 2) + '\n', 'utf8');
    const state = this.readState();
    if (state.active === from) this.writeState({ ...state, active: to });
    return dest;
  }

  stashPush(sources: SnapshotSource[]): StashEntry {
    ensureProjectContextRoot(this.projectRoot);
    const dir = path.join(stashRoot(this.projectRoot), stashEntryName());
    const manifest = writeSnapshot(dir, sources, { label: null });
    return { dir, manifest };
  }

  /** Newest first. */
  stashEntries(): StashEntry[] {
    const root = stashRoot(this.projectRoot);
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root)
      .filter((name) => snapshotExists(path.join(root, name)))
      .sort((a, b) => b.localeCompare(a))
      .map((name) => {
        const dir = path.join(root, name);
        return { dir, manifest: readSnapshotManifest(dir) };
      });
  }

  stashPeek(): StashEntry | null {
    return this.stashEntries()[0] ?? null;
  }

  stashDrop(dir: string): void {
    removeSnapshot(dir);
  }
}

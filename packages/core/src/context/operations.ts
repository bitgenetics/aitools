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
import type { Catalog, ContextScope, SnapshotFile, SnapshotManifest } from './types.js';
import { isIgnored } from './ignore-glob.js';
import type { SnapshotSource } from './snapshot.js';
import { readSnapshotManifest } from './snapshot.js';
import type { ContextStore, ListedSnapshot, StashEntry } from './store.js';
import { applySnapshot, assertCatalogPath, clearWorkingTree, dirtyPaths, hashWorkingTree, workingAbs } from './working-tree.js';

const DIRTY_PREVIEW_COUNT = 3;

export interface OverwriteOptions {
  /** Proceed even when the working tree has unsaved changes. */
  discard?: boolean;
  /** Compute the plan without touching disk. */
  dryRun?: boolean;
}

export class DirtyWorkingTreeError extends Error {
  constructor(public readonly paths: string[]) {
    super(
      `Working AI context differs from the last saved state (${paths.length} file(s)). ` +
        `Run "aitools context save <label>" or "aitools context stash" first, or pass --discard. ` +
        `First: ${paths.slice(0, DIRTY_PREVIEW_COUNT).join(', ')}`,
    );
    this.name = 'DirtyWorkingTreeError';
  }
}

export class EmptyStashError extends Error {
  constructor() {
    super('The context stash is empty.');
    this.name = 'EmptyStashError';
  }
}

/** Outcome of an operation that replaced the working tree. */
export interface ApplyResult {
  active: string | null;
  scope: ContextScope | null;
  removed: string[];
  written: string[];
  /** Snapshot files that matched `context.ignore` and were left alone. */
  skipped: string[];
  dryRun: boolean;
}

export interface ContextStatus {
  active: string | null;
  scope: ContextScope | null;
  dirty: string[];
  stashDepth: number;
  catalogCount: number;
  ignoredCount: number;
}

function workingSources(catalog: Catalog): SnapshotSource[] {
  return catalog.entries.map((e) => ({ path: e.path, srcAbs: workingAbs(catalog.root, e.path) }));
}

/** Snapshot files that apply to this project: validated, minus `context.ignore` matches. */
export function partitionApplicable(
  store: ContextStore,
  manifest: SnapshotManifest,
): { applicable: SnapshotFile[]; skipped: string[] } {
  for (const file of manifest.files) assertCatalogPath(store.projectRoot, file.path);
  const applicable: SnapshotFile[] = [];
  const skipped: string[] = [];
  for (const file of manifest.files) {
    if (isIgnored(file.path, store.ignore)) skipped.push(file.path);
    else applicable.push(file);
  }
  return { applicable, skipped };
}

interface ReplacePlan {
  active: string | null;
  scope: ContextScope | null;
  /** Null for `clear`. */
  source: { dir: string; manifest: SnapshotManifest } | null;
}

/**
 * The one way the working tree gets replaced. Order is the safety guarantee:
 * validate source → check clean → write state → clear → apply.
 */
function replaceWorkingTree(store: ContextStore, plan: ReplacePlan, options: OverwriteOptions): ApplyResult {
  const { applicable, skipped } = plan.source
    ? partitionApplicable(store, plan.source.manifest)
    : { applicable: [], skipped: [] };

  const catalog = store.catalog();
  const dirty = dirtyPaths(catalog, store.readState());
  if (dirty.length > 0 && !options.discard) throw new DirtyWorkingTreeError(dirty);

  const result: ApplyResult = {
    active: plan.active,
    scope: plan.scope,
    removed: catalog.entries.map((e) => e.path),
    written: applicable.map((f) => f.path),
    skipped,
    dryRun: options.dryRun === true,
  };
  if (options.dryRun) return result;

  store.writeState({ active: plan.active, scope: plan.scope, files: applicable });
  result.removed = clearWorkingTree(catalog);
  result.written = plan.source ? applySnapshot(store.projectRoot, plan.source.dir, applicable) : [];
  return result;
}

/** Snapshot the working tree under a label; that label becomes active and the tree is clean. */
export function save(store: ContextStore, label: string, scope: ContextScope): ListedSnapshot {
  const saved = store.writeNamed(label, scope, workingSources(store.catalog()));
  store.writeState({ active: label, scope, files: saved.manifest.files });
  return saved;
}

/** Push the working tree onto the stash. Working files stay; the tree is now clean. */
export function stash(store: ContextStore): StashEntry {
  const entry = store.stashPush(workingSources(store.catalog()));
  const state = store.readState();
  store.writeState({ ...state, files: entry.manifest.files });
  return entry;
}

export function switchTo(store: ContextStore, label: string, options: OverwriteOptions = {}): ApplyResult {
  const ref = store.require(label);
  const manifest = readSnapshotManifest(ref.dir);
  return replaceWorkingTree(store, { active: ref.label, scope: ref.scope, source: { dir: ref.dir, manifest } }, options);
}

/** Replace the working tree with the top stash entry, then drop that entry. */
export function pop(store: ContextStore, options: OverwriteOptions = {}): ApplyResult {
  const entry = store.stashPeek();
  if (!entry) throw new EmptyStashError();
  const result = replaceWorkingTree(store, { active: null, scope: null, source: entry }, options);
  if (!options.dryRun) store.stashDrop(entry.dir);
  return result;
}

export function clear(store: ContextStore, options: OverwriteOptions = {}): ApplyResult {
  return replaceWorkingTree(store, { active: null, scope: null, source: null }, options);
}

export function status(store: ContextStore): ContextStatus {
  const catalog = store.catalog();
  const state = store.readState();
  return {
    active: state.active,
    scope: state.scope,
    dirty: dirtyPaths(catalog, state),
    stashDepth: store.stashEntries().length,
    catalogCount: catalog.entries.length,
    ignoredCount: catalog.ignored.length,
  };
}

export { hashWorkingTree };

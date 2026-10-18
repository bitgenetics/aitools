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

export type {
  ContextScope,
  CatalogKind,
  CatalogEntry,
  Catalog,
  SnapshotFile,
  SnapshotOrigin,
  SnapshotManifest,
  SnapshotRef,
  ContextState,
  AiToolsContextConfig,
} from './types.js';

export {
  CONTEXT_DIR,
  STASH_DIR,
  STATE_FILE,
  SNAPSHOT_MANIFEST_FILE,
  contextRoot,
  snapshotDir,
  stashRoot,
  statePath,
  ensureProjectContextRoot,
} from './paths.js';

export { toProjectRel, matchGlob, isIgnored, normalizeGlobList } from './ignore-glob.js';

export { classify, buildCatalog } from './catalog.js';

export {
  hashFile,
  snapshotExists,
  snapshotFileAbs,
  readSnapshotManifest,
  writeSnapshot,
  removeSnapshot,
  SnapshotNotFoundError,
} from './snapshot.js';
export type { SnapshotSource, SnapshotMeta } from './snapshot.js';

export { EMPTY_STATE, readState, writeState } from './state.js';

export {
  hashWorkingTree,
  diffFiles,
  dirtyPaths,
  assertCatalogPath,
  clearWorkingTree,
  applySnapshot,
  OutsideCatalogError,
} from './working-tree.js';
export type { FileDiff } from './working-tree.js';

export {
  ContextStore,
  LABEL_PATTERN,
  assertValidLabel,
  readContextIgnore,
  InvalidLabelError,
  UnknownLabelError,
  LabelExistsError,
  ActiveSnapshotError,
} from './store.js';
export type { ContextStoreOptions, ListedSnapshot, StashEntry } from './store.js';

export {
  save,
  stash,
  switchTo,
  pop,
  clear,
  status,
  partitionApplicable,
  DirtyWorkingTreeError,
  EmptyStashError,
} from './operations.js';
export type { OverwriteOptions, ApplyResult, ContextStatus } from './operations.js';

export { merge, MergeConflictError } from './merge.js';
export type { MergeOptions, MergeResult } from './merge.js';

export {
  CONTEXT_PROFILE_CATEGORY,
  defaultLabelForPackage,
  importSnapshotFromPackage,
  snapshotToPublishPayload,
  NotContextProfileError,
} from './registry-bridge.js';
export type { ImportPackageOptions, PublishPayload, SnapshotPublishMeta } from './registry-bridge.js';

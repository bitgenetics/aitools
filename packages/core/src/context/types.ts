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

/** Where a named snapshot lives. Mirrors the settings model: user is the default, project overrides on read. */
export type ContextScope = 'user' | 'project';

/** Kind of AI mechanism a cataloged path is. `classify()` in catalog.ts is the single authority. */
export type CatalogKind =
  | 'instructions'
  | 'rule'
  | 'skill'
  | 'agent'
  | 'command'
  | 'hooks-config'
  | 'mcp-config'
  | 'settings'
  | 'vendor-tree';

export interface CatalogEntry {
  /** Project-relative POSIX path. */
  path: string;
  kind: CatalogKind;
}

/** Deterministic list of managed AI-mech paths under a root, minus `context.ignore` matches. */
export interface Catalog {
  root: string;
  entries: CatalogEntry[];
  /** Paths that classified as AI-mech but were excluded by `context.ignore`. Never touched. */
  ignored: string[];
}

export interface SnapshotFile {
  path: string;
  sha256: string;
}

/** Registry package a snapshot was imported from. */
export interface SnapshotOrigin {
  package: string;
  version: string;
  registry: string;
}

/** `manifest.json` inside a snapshot folder. */
export interface SnapshotManifest {
  /** Null for stash entries. */
  label: string | null;
  createdAt: string;
  origin?: SnapshotOrigin;
  files: SnapshotFile[];
}

/** A resolved snapshot location. */
export interface SnapshotRef {
  label: string;
  scope: ContextScope;
  dir: string;
}

/**
 * Project-local record of what the tool last saved or applied.
 * `files` is the clean baseline: the working tree is dirty when it differs from these hashes.
 */
export interface ContextState {
  active: string | null;
  scope: ContextScope | null;
  files: SnapshotFile[];
}

/** `context` block on project `aitools.json`. */
export interface AiToolsContextConfig {
  /** Globs for paths that are outside the catalog: never read, copied, or deleted. */
  ignore?: string[];
}

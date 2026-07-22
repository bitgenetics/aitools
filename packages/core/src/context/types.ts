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

/** How a context profile is applied relative to the stay-set. */
export type ContextSwapMode = 'replace' | 'overlay';

export interface ContextBaselineConfig {
  /** Optional registry package name for baseline bootstrap/fallback. */
  package?: string;
  /** Optional local snapshot id from `context capture`. */
  snapshotId?: string;
}

export interface ContextProfileConfig {
  /** Registry package name (`category: context-profile`). */
  package: string;
  mode: ContextSwapMode;
}

/** Optional `context` block on project `aitools.json`. */
export interface AiToolsContextConfig {
  baseline?: ContextBaselineConfig;
  /** Project-relative globs/paths that must never be quarantined (overlay stay-set). */
  stay?: string[];
  profiles?: Record<string, ContextProfileConfig>;
}

export type AiMechKind =
  | 'agents-md'
  | 'claude-md'
  | 'cursor-rule'
  | 'cursor-skill'
  | 'cursor-agent'
  | 'cursor-command'
  | 'claude-tree'
  | 'agents-tree'
  | 'mcp-config'
  | 'hooks-config'
  | 'other';

export interface AiMechEntry {
  /** Project-relative POSIX path. */
  path: string;
  kind: AiMechKind;
  /** True when path matches authored stay globs. */
  stay: boolean;
}

export interface AiMechInventory {
  root: string;
  generatedAt: string;
  entries: AiMechEntry[];
}

export interface QuarantineMove {
  /** Project-relative original path. */
  from: string;
  /** Path relative to quarantine dir (mirrors from). */
  to: string;
}

export interface QuarantineManifest {
  id: string;
  createdAt: string;
  root: string;
  moves: QuarantineMove[];
}

export interface ContextLockProfile {
  name: string;
  package: string;
  version: string;
  resolved: string;
  integrity: string;
  files: string[];
  installedAt: string;
}

/** Top-level `context` on `aitools-lock.json` (optional; lockfileVersion stays 1). */
export interface AiToolsContextLock {
  activeProfile: string | null;
  quarantineId?: string;
  moves?: QuarantineMove[];
  snapshotId?: string;
  fileHashes?: Record<string, string>;
  baselinePackage?: string;
  profile?: ContextLockProfile;
}

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
import type { ToolCategory } from './tool.js';

/** Canonical categories after normalizing deprecated aliases. */
export type NormalizedCategory =
  | 'skill'
  | 'rule'
  | 'command'
  | 'agent'
  | 'hook'
  | 'mcp-tool'
  | 'plugin'
  | 'reference';

export interface CategoryNormalization {
  category: NormalizedCategory;
  /** True when a deprecated alias was mapped (subagent → agent, prompt → command). */
  deprecatedAlias: boolean;
  /** Human-readable note when the alias is ambiguous or lossy. */
  warning?: string;
}

/**
 * Map deprecated manifest categories to canonical ones.
 * `subagent` → `agent`; `prompt` → `command` (with ambiguity warning).
 */
export function normalizeCategory(category: ToolCategory): CategoryNormalization {
  switch (category) {
    case 'subagent':
      return {
        category: 'agent',
        deprecatedAlias: true,
        warning: 'category "subagent" is deprecated — use "agent"',
      };
    case 'prompt':
      return {
        category: 'command',
        deprecatedAlias: true,
        warning: 'category "prompt" is deprecated and ambiguous — use "command" or "rule"',
      };
    default:
      return { category, deprecatedAlias: false };
  }
}

/** File-based categories installed as regular files (not MCP config, hook merge, or plugin bundle). */
export type FileCategory = Exclude<NormalizedCategory, 'mcp-tool' | 'hook' | 'plugin' | 'reference'>;

export function isFileCategory(category: NormalizedCategory): category is FileCategory {
  return category !== 'mcp-tool' && category !== 'hook' && category !== 'plugin' && category !== 'reference';
}

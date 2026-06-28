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
import type { ToolCategory, TargetPlatform } from '../types/tool.js';

/**
 * How a given SKILL.md frontmatter field behaves on a platform.
 * - supported:   The platform reads and acts on this field.
 * - ignored:     The platform loads the skill but silently ignores the field.
 * - unsupported: The platform does not support skills at all, or the field
 *                causes a load failure.
 * - unknown:     Behaviour has not been verified for this platform.
 */
export type FieldSupport = 'supported' | 'ignored' | 'unsupported' | 'unknown';

/**
 * Describes how a single SKILL.md frontmatter field behaves on a platform.
 */
export interface SkillFieldSpec {
  /** Whether the field is required by the agentskills.io base spec. */
  required: boolean;
  /** How this platform treats the field. */
  support: FieldSupport;
  /** True when this field is a platform extension not in the base spec. */
  platformExtension: boolean;
  /** Human-readable note about platform-specific behaviour, if any. */
  note?: string;
}

/**
 * Install path pair for a single category and scope.
 */
export interface InstallPathSpec {
  project: string;
  user: string;
}

/**
 * Full specification of a platform's behaviour.
 * Used by the `compat` command and by adapter classes.
 */
export interface PlatformSpec {
  /** Platform identifier — must match TargetPlatform. */
  id: TargetPlatform;
  /** Human-readable display name. */
  name: string;
  /** URL of the official documentation for skills/agents on this platform. */
  docsUrl: string;
  /**
   * ISO-8601 date this spec was last verified against the platform's docs.
   * The `compat` command warns when this is more than 90 days ago.
   */
  lastVerified: string;
  /** Which tool categories are supported on this platform. */
  supportedCategories: ToolCategory[];
  /**
   * SKILL.md frontmatter fields and their support status.
   * Covers both base spec fields and platform extensions.
   */
  skillFrontmatter: Record<string, SkillFieldSpec>;
  /** Project-scope and user-scope install paths per category. */
  installPaths: Partial<Record<Exclude<ToolCategory, 'mcp-tool' | 'hook'>, InstallPathSpec>> & {
    mcpConfig?: { project: string; user: string };
    hookConfig?: { project: string; user: string };
  };
}

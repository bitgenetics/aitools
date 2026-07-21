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
import { classifyPluginMembers } from './plugin-explode.js';
import type { ClassifyPluginOptions, PluginMember } from './plugin-explode.js';
import { sanitizePackageDirName } from './plugin-install.js';

/**
 * Portability grade for a plugin bundle.
 * - `transform-free`: all shared content lives under `skills/<name>/…`; sibling skills
 *   reference each other via `../<sibling>/…` which resolves 1:1 after explode (no rewrite).
 * - `rewrite-required`: shared content is kept at plugin root (`assets/`/`scripts/`), so
 *   `rewriteRelativePaths` must relocate links at install time.
 * - `unsupported`: one or more files have no install home (orphans) — install would fail.
 */
export type PluginPortabilityGrade = 'transform-free' | 'rewrite-required' | 'unsupported';

export type PluginPortabilityFindingKind =
  | 'orphan'
  | 'root-shared-content'
  | 'missing-anchor'
  | 'ok';

export interface PluginPortabilityFinding {
  kind: PluginPortabilityFindingKind;
  message: string;
  /** Package-relative source path when the finding is tied to a specific file. */
  src?: string;
}

export interface PluginPortabilityResult {
  grade: PluginPortabilityGrade;
  /** Expected anchor skill folder name for this package. */
  anchor: string;
  /** True when a `skills/<anchor>/…` (or root `SKILL.md`) member is present. */
  hasAnchor: boolean;
  /** Skill folder names discovered in the bundle (excluding the anchor). */
  memberSkills: string[];
  findings: PluginPortabilityFinding[];
}

/**
 * The expected hub skill folder name for a plugin package.
 * Named after the package so shared `assets/`/`scripts/` (which explode under
 * `<sanitized-name>/…`) and the hub skill (`skills/<name>/…`) share one install dir.
 */
export function anchorSkillName(packageName: string): string {
  return sanitizePackageDirName(packageName);
}

/** Top-level skill folder for a classified skill member's `destWithinCategory`. */
function skillFolderOf(destWithinCategory: string): string {
  const slash = destWithinCategory.indexOf('/');
  return slash === -1 ? destWithinCategory : destWithinCategory.slice(0, slash);
}

/**
 * Grade a plugin bundle's portability from its declared sources.
 * Pure over `sources` (no filesystem access) so it is safe in core and easy to test.
 * Skill-map completeness (which requires reading the anchor `SKILL.md`) is a separate
 * concern handled by the CLI via {@link extractSkillMapSkills}.
 */
export function analyzePluginPortability(opts: ClassifyPluginOptions): PluginPortabilityResult {
  const anchor = anchorSkillName(opts.packageName);
  const { members, errors } = classifyPluginMembers(opts);

  const skillFolders = new Set<string>();
  for (const m of members) {
    if (m.kind === 'skill') {
      skillFolders.add(skillFolderOf(m.destWithinCategory));
    }
  }
  const hasAnchor = skillFolders.has(anchor);
  const memberSkills = [...skillFolders].filter((s) => s !== anchor).sort();

  const findings: PluginPortabilityFinding[] = [];

  for (const err of errors) {
    findings.push({ kind: 'orphan', message: err });
  }

  const rootShared = members.filter((m: PluginMember) => m.kind === 'asset');
  for (const m of rootShared) {
    findings.push({
      kind: 'root-shared-content',
      src: m.src,
      message: `root-level shared content requires path rewrite at install: ${m.src} (author it under skills/${anchor}/ to stay transform-free)`,
    });
  }

  if (!hasAnchor && skillFolders.size > 0) {
    findings.push({
      kind: 'missing-anchor',
      message: `no anchor skill "skills/${anchor}/" — add a hub skill named after the package to own shared content and the skill-map`,
    });
  }

  let grade: PluginPortabilityGrade;
  if (errors.length > 0) {
    grade = 'unsupported';
  } else if (rootShared.length > 0) {
    grade = 'rewrite-required';
  } else {
    grade = 'transform-free';
  }

  if (findings.length === 0) {
    findings.push({ kind: 'ok', message: 'transform-free: all members install 1:1 with no path rewrite' });
  }

  return { grade, anchor, hasAnchor, memberSkills, findings };
}

// -- Anchor SKILL.md skill-map management -------------------------------------
// The skill-map is a managed markdown section inside the anchor SKILL.md. Scaffolding
// tools (manifest init, compat --fix) may replace only this section, never author prose.

export const SKILL_MAP_BEGIN = '<!-- aitools:skill-map:begin -->';
export const SKILL_MAP_END = '<!-- aitools:skill-map:end -->';

/** Render the managed skill-map section body (between the markers). */
export function renderSkillMap(anchor: string, memberSkills: string[]): string {
  const lines = [
    SKILL_MAP_BEGIN,
    '## Skill map',
    '',
    `This plugin's hub is the **${anchor}** skill. Shared references, assets, and scripts live here; other skills link back via \`../${anchor}/…\`.`,
    '',
  ];
  if (memberSkills.length > 0) {
    lines.push('Member skills:');
    for (const s of memberSkills) {
      lines.push(`- \`${s}\` — see \`../${s}/SKILL.md\``);
    }
  } else {
    lines.push('_No additional member skills yet._');
  }
  lines.push('', SKILL_MAP_END);
  return lines.join('\n');
}

/**
 * Extract the skill names currently listed in the managed skill-map section.
 * Returns an empty array when no managed section is present.
 */
export function extractSkillMapSkills(content: string): string[] {
  const start = content.indexOf(SKILL_MAP_BEGIN);
  const end = content.indexOf(SKILL_MAP_END);
  if (start === -1 || end === -1 || end < start) return [];
  const body = content.slice(start, end);
  const skills: string[] = [];
  const re = /^- `([^`]+)`/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    skills.push(match[1]!);
  }
  return skills;
}

/**
 * Insert or replace the managed skill-map section in an anchor SKILL.md.
 * If markers exist, only the section between them is replaced; otherwise the section
 * is appended. Author prose outside the markers is never touched.
 */
export function upsertSkillMapSection(content: string, rendered: string): string {
  const start = content.indexOf(SKILL_MAP_BEGIN);
  const end = content.indexOf(SKILL_MAP_END);
  if (start !== -1 && end !== -1 && end >= start) {
    const before = content.slice(0, start);
    const after = content.slice(end + SKILL_MAP_END.length);
    return `${before}${rendered}${after}`;
  }
  const sep = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${sep}${rendered}\n`;
}

/**
 * Build a complete anchor SKILL.md when none exists yet.
 * `description` seeds the frontmatter; the managed skill-map section is appended.
 */
export function scaffoldAnchorSkill(
  anchor: string,
  memberSkills: string[],
  description = `Hub skill for the ${anchor} plugin.`,
): string {
  const frontmatter = ['---', `name: ${anchor}`, `description: ${description}`, '---', ''].join('\n');
  const intro = [
    `# ${anchor}`,
    '',
    `Hub skill for the **${anchor}** plugin. Document how the member skills work together here, and keep shared references, assets, and scripts under this skill so they install transform-free.`,
    '',
  ].join('\n');
  return `${frontmatter}${intro}${renderSkillMap(anchor, memberSkills)}\n`;
}

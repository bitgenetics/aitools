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
import { sanitizePackageDirName } from './plugin-install.js';
import type { FileCategory } from '../types/category.js';

/** Kind of member produced when exploding a plugin bundle. */
export type PluginMemberKind =
  | 'skill'
  | 'rule'
  | 'command'
  | 'agent'
  | 'mcp'
  | 'hook'
  | 'asset'
  | 'skip';

/**
 * A classified file from a plugin package.
 * `destWithinCategory` is relative to the platform category install directory
 * (for skill/rule/command/agent/asset). Empty for mcp/hook/skip.
 */
export interface PluginMember {
  kind: PluginMemberKind;
  /** Package-relative path (forward slashes). */
  src: string;
  /** Destination under the category install base (forward slashes). */
  destWithinCategory: string;
  /** Adapter category used for resolveDir; skill for assets. */
  fileCategory?: FileCategory;
}

/** Optional path overrides from `.cursor-plugin/plugin.json`. */
export interface CursorPluginJsonPaths {
  name?: string;
  skills?: string | string[];
  rules?: string | string[];
  agents?: string | string[];
  commands?: string | string[];
  hooks?: string | Record<string, unknown>;
  mcpServers?: string | Record<string, unknown> | unknown[];
  logo?: string;
}

export interface ClassifyPluginOptions {
  packageName: string;
  /** Package-relative source paths (typically manifest `files[].src`). */
  sources: string[];
  /** Parsed `.cursor-plugin/plugin.json` when available. */
  pluginJson?: CursorPluginJsonPaths | null;
}

export interface ClassifyPluginResult {
  members: PluginMember[];
  errors: string[];
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function asRootList(value: string | string[] | undefined, fallback: string): string[] {
  if (value === undefined) return [fallback];
  const list = Array.isArray(value) ? value : [value];
  return list.map((r) => {
    let n = norm(r);
    if (!n.endsWith('/')) n += '/';
    return n;
  });
}

function firstStringPath(value: string | Record<string, unknown> | unknown[] | undefined, fallback: string): string {
  if (typeof value === 'string') return norm(value);
  return fallback;
}

function isSkipPath(src: string): boolean {
  if (src === '.cursor-plugin' || src.startsWith('.cursor-plugin/')) return true;
  const base = src.split('/').pop() ?? src;
  if (/^readme(\.|$)/i.test(base)) return true;
  if (/^license(\.|$)/i.test(base)) return true;
  if (base === 'aitools.json' || base === 'aitools-lock.json' || base === 'aitools.config.json') return true;
  if (base === 'marketplace.json') return true;
  return false;
}

function underRoot(src: string, root: string): string | null {
  const r = root.endsWith('/') ? root : `${root}/`;
  if (src === r.slice(0, -1)) return '';
  if (src.startsWith(r)) return src.slice(r.length);
  return null;
}

function underAnyRoot(src: string, roots: string[]): string | null {
  for (const root of roots) {
    const rel = underRoot(src, root);
    if (rel !== null) return rel;
  }
  return null;
}

/** Directories and root files scanned when discovering plugin bundle content. */
export interface PluginBundleScanPlan {
  /** Package-relative directory roots (trailing slash). */
  directories: string[];
  /** Package-relative files to include when present (e.g. mcp.json, SKILL.md). */
  files: string[];
}

/**
 * Layout roots used by `manifest init --category plugin` and bundle discovery.
 * Mirrors the classifier's default Cursor plugin tree plus `.cursor-plugin/`.
 */
export function getPluginBundleScanPlan(
  pluginJson?: CursorPluginJsonPaths | null,
): PluginBundleScanPlan {
  const pj = pluginJson ?? undefined;

  const skillRoots = asRootList(pj?.skills, 'skills/');
  const ruleRoots = asRootList(pj?.rules, 'rules/');
  const agentRoots = asRootList(pj?.agents, 'agents/');
  const commandRoots = asRootList(pj?.commands, 'commands/');

  let hooksRoot = 'hooks/';
  if (typeof pj?.hooks === 'string') {
    const h = norm(pj.hooks);
    hooksRoot = h.endsWith('/')
      ? h
      : h.includes('/')
        ? `${h.split('/').slice(0, -1).join('/')}/`
        : 'hooks/';
  }

  const mcpPath = firstStringPath(
    typeof pj?.mcpServers === 'string' ? pj.mcpServers : undefined,
    'mcp.json',
  );

  return {
    directories: [
      ...skillRoots,
      ...ruleRoots,
      ...agentRoots,
      ...commandRoots,
      hooksRoot,
      'assets/',
      'scripts/',
      '.cursor-plugin/',
    ],
    files: [mcpPath, 'SKILL.md'],
  };
}

/**
 * Keep only bundle paths that classify to an install home (or allowed skip).
 * Orphans are returned in `errors` for caller warnings.
 */
export function resolvePluginBundleSources(
  candidates: string[],
  opts: ClassifyPluginOptions,
): { sources: string[]; errors: string[] } {
  const { members, errors } = classifyPluginMembers({ ...opts, sources: candidates });
  return { sources: members.map((m) => m.src), errors };
}

/**
 * Classify plugin package files into explode members.
 * Orphan paths (no home) are reported in `errors` — callers must treat them as fatal.
 */
export function classifyPluginMembers(opts: ClassifyPluginOptions): ClassifyPluginResult {
  const pkgDir = sanitizePackageDirName(opts.packageName);
  const pj = opts.pluginJson ?? undefined;

  const skillRoots = asRootList(pj?.skills, 'skills/');
  const ruleRoots = asRootList(pj?.rules, 'rules/');
  const agentRoots = asRootList(pj?.agents, 'agents/');
  const commandRoots = asRootList(pj?.commands, 'commands/');

  let hooksRoot = 'hooks/';
  if (typeof pj?.hooks === 'string') {
    const h = norm(pj.hooks);
    hooksRoot = h.endsWith('/') ? h : h.includes('/') ? `${h.split('/').slice(0, -1).join('/')}/` : 'hooks/';
  }

  const mcpPath = firstStringPath(
    typeof pj?.mcpServers === 'string' ? pj.mcpServers : undefined,
    'mcp.json',
  );

  const members: PluginMember[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const raw of opts.sources) {
    const src = norm(raw);
    if (!src || seen.has(src)) continue;
    seen.add(src);

    if (isSkipPath(src)) {
      members.push({ kind: 'skip', src, destWithinCategory: '' });
      continue;
    }

    if (src === mcpPath) {
      members.push({ kind: 'mcp', src, destWithinCategory: '' });
      continue;
    }

    const skillRel = underAnyRoot(src, skillRoots);
    if (skillRel !== null) {
      members.push({
        kind: 'skill',
        src,
        destWithinCategory: skillRel,
        fileCategory: 'skill',
      });
      continue;
    }

    const ruleRel = underAnyRoot(src, ruleRoots);
    if (ruleRel !== null) {
      members.push({
        kind: 'rule',
        src,
        destWithinCategory: ruleRel,
        fileCategory: 'rule',
      });
      continue;
    }

    const agentRel = underAnyRoot(src, agentRoots);
    if (agentRel !== null) {
      members.push({
        kind: 'agent',
        src,
        destWithinCategory: agentRel,
        fileCategory: 'agent',
      });
      continue;
    }

    const commandRel = underAnyRoot(src, commandRoots);
    if (commandRel !== null) {
      members.push({
        kind: 'command',
        src,
        destWithinCategory: commandRel,
        fileCategory: 'command',
      });
      continue;
    }

    const hooksRel = underRoot(src, hooksRoot);
    if (hooksRel !== null) {
      members.push({ kind: 'hook', src, destWithinCategory: '' });
      continue;
    }

    const assetsRel = underRoot(src, 'assets/');
    if (assetsRel !== null) {
      members.push({
        kind: 'asset',
        src,
        destWithinCategory: `${pkgDir}/assets/${assetsRel}`,
        fileCategory: 'skill',
      });
      continue;
    }

    const scriptsRel = underRoot(src, 'scripts/');
    if (scriptsRel !== null) {
      members.push({
        kind: 'asset',
        src,
        destWithinCategory: `${pkgDir}/scripts/${scriptsRel}`,
        fileCategory: 'skill',
      });
      continue;
    }

    // Root SKILL.md (single-skill plugin) when no skills/ dir entries
    if (src === 'SKILL.md') {
      members.push({
        kind: 'skill',
        src,
        destWithinCategory: `${pkgDir}/SKILL.md`,
        fileCategory: 'skill',
      });
      continue;
    }

    errors.push(
      `plugin file has no install home: ${src} (move shared content under a skill, e.g. skills/${pkgDir}/references/ or skills/${pkgDir}/assets/)`,
    );
  }

  return { members, errors };
}

/**
 * Validate that every non-skip plugin file has an install home.
 * Returns structured errors suitable for manifest validate / install guards.
 */
export function validatePluginStructure(opts: ClassifyPluginOptions): { ok: boolean; errors: string[] } {
  const { errors } = classifyPluginMembers(opts);
  return { ok: errors.length === 0, errors };
}

/** Parse `.cursor-plugin/plugin.json` content; returns null on failure. */
export function parseCursorPluginJson(raw: string): CursorPluginJsonPaths | null {
  try {
    return JSON.parse(raw) as CursorPluginJsonPaths;
  } catch {
    return null;
  }
}

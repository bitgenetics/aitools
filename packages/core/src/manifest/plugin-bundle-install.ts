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
import type { FileCategory } from '../types/category.js';
import type { CursorPluginJsonPaths } from './plugin-explode.js';
import { getPluginBundleScanPlan, parseCursorPluginJson } from './plugin-explode.js';

export class PluginBundleInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginBundleInstallError';
  }
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function asRootList(value: string | string[] | undefined, fallback: string): string[] {
  if (value === undefined) return [fallback.endsWith('/') ? fallback : `${fallback}/`];
  const list = Array.isArray(value) ? value : [value];
  return list.map((r) => {
    let n = norm(r);
    if (!n.endsWith('/')) n += '/';
    return n;
  });
}

/**
 * Load `.cursor-plugin/plugin.json` from a project cwd when present.
 */
export function loadCursorPluginJsonFromCwd(cwd: string): CursorPluginJsonPaths | null {
  const descriptorPath = path.join(cwd, '.cursor-plugin', 'plugin.json');
  if (!fs.existsSync(descriptorPath)) return null;
  try {
    return parseCursorPluginJson(fs.readFileSync(descriptorPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve the absolute install base directory for a file category under plugin author layout.
 * Uses the first matching root from `.cursor-plugin/plugin.json` overrides when present.
 */
export function resolvePluginBundleInstallBase(
  category: FileCategory,
  cwd: string,
  pluginJson?: CursorPluginJsonPaths | null,
): string {
  const pj = pluginJson ?? undefined;
  let relativeRoot: string;

  switch (category) {
    case 'skill':
      relativeRoot = asRootList(pj?.skills, 'skills/')[0]!;
      break;
    case 'rule':
      relativeRoot = asRootList(pj?.rules, 'rules/')[0]!;
      break;
    case 'command':
      relativeRoot = asRootList(pj?.commands, 'commands/')[0]!;
      break;
    case 'agent':
      relativeRoot = asRootList(pj?.agents, 'agents/')[0]!;
      break;
    default: {
      const _exhaustive: never = category;
      throw new PluginBundleInstallError(`Unsupported plugin-bundle file category: ${_exhaustive}`);
    }
  }

  return path.resolve(cwd, relativeRoot);
}

/**
 * Resolve absolute path to the plugin author-layout MCP config (`mcp.json` by default).
 */
export function resolvePluginBundleMcpConfig(
  cwd: string,
  pluginJson?: CursorPluginJsonPaths | null,
): string {
  const plan = getPluginBundleScanPlan(pluginJson);
  // Scan plan lists mcp path first, then optional root SKILL.md
  const mcpRel = plan.files.find((f) => f !== 'SKILL.md') ?? 'mcp.json';
  return path.resolve(cwd, mcpRel);
}

/**
 * Resolve absolute path to the plugin author-layout hooks config (`hooks/hooks.json` by default).
 */
export function resolvePluginBundleHooksConfig(
  cwd: string,
  pluginJson?: CursorPluginJsonPaths | null,
): string {
  const pj = pluginJson ?? undefined;
  if (typeof pj?.hooks === 'string' && pj.hooks.trim()) {
    const h = pj.hooks.replace(/\\/g, '/').replace(/^\.\//, '');
    if (h.endsWith('.json')) {
      return path.resolve(cwd, h);
    }
    const root = h.endsWith('/') ? h : `${h}/`;
    return path.resolve(cwd, root, 'hooks.json');
  }
  return path.resolve(cwd, 'hooks', 'hooks.json');
}

/** Absolute paths that already exist and are not owned by the package being (re)installed. */
export function findPluginBundleCollisions(
  plannedAbsPaths: string[],
  ownedAbsPaths: Iterable<string> = [],
): string[] {
  const owned = new Set(
    [...ownedAbsPaths].map((p) => path.resolve(p).replace(/\\/g, '/').toLowerCase()),
  );
  const seen = new Set<string>();
  const collisions: string[] = [];
  for (const dest of plannedAbsPaths) {
    const abs = path.resolve(dest);
    const key = abs.replace(/\\/g, '/').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (fs.existsSync(abs) && !owned.has(key)) {
      collisions.push(abs);
    }
  }
  return collisions;
}

/**
 * Upsert project-relative author-layout paths into the host publish `files[]`.
 * `src` and `dest` are both the author-layout relative path (e.g. `skills/foo/SKILL.md`).
 */
export function upsertHostPublishFileEntries(
  manifest: import('../types/config.js').AiToolsManifest,
  relPaths: string[],
): import('../types/config.js').AiToolsManifest {
  const files = [...(manifest.files ?? [])];
  for (const raw of relPaths) {
    const n = norm(raw.replace(/\\/g, '/'));
    if (!n || n === '.cursor-plugin' || n.startsWith('.cursor-plugin/')) continue;
    const idx = files.findIndex((f) => norm(f.src) === n || norm(f.dest) === n);
    const entry = { src: n, dest: n, placementMode: 'strict' as const };
    if (idx >= 0) {
      files[idx] = { ...files[idx], src: n, dest: n };
    } else {
      files.push(entry);
    }
  }
  return { ...manifest, files };
}

/** Remove publish `files[]` entries whose src or dest matches any of the relative paths. */
export function removeHostPublishFileEntries(
  manifest: import('../types/config.js').AiToolsManifest,
  relPaths: string[],
): import('../types/config.js').AiToolsManifest {
  if (!manifest.files?.length || relPaths.length === 0) return manifest;
  const remove = new Set(relPaths.map((p) => norm(p.replace(/\\/g, '/'))).filter(Boolean));
  const files = manifest.files.filter((f) => !remove.has(norm(f.src)) && !remove.has(norm(f.dest)));
  return { ...manifest, files };
}

/**
 * Fail when a nested plugin is not safe to explode into a host author tree.
 * Allows path-rewrite-free (including missing-anchor-only). Rejects unsupported / rewrite-required.
 */
export function assertPluginBundleNestPortability(grade: import('./plugin-anchor.js').PluginPortabilityGrade): void {
  if (grade === 'unsupported') {
    throw new PluginBundleInstallError(
      'Nested plugin has orphan files (portability grade: unsupported). Fix the package structure before installing with --plugin-bundle.',
    );
  }
  if (grade === 'rewrite-required') {
    throw new PluginBundleInstallError(
      'Nested plugin requires path rewrite (root assets/scripts). Re-author shared content under the hub skill (skills/<name>/) so the nest stays path-rewrite-free.',
    );
  }
}

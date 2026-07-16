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

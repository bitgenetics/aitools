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
import type { AiMechEntry, AiMechInventory, AiMechKind } from './types.js';
import { isStayPath, toProjectRel } from './stay.js';

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.aitools',
  'dist',
  'coverage',
  'build',
  '.next',
  'out',
]);

const ROOT_MARKERS: Array<{ name: string; kind: AiMechKind }> = [
  { name: 'AGENTS.md', kind: 'agents-md' },
  { name: 'CLAUDE.md', kind: 'claude-md' },
];

const SCOPED_TREES: Array<{ rel: string; kind: AiMechKind }> = [
  { rel: '.cursor/rules', kind: 'cursor-rule' },
  { rel: '.cursor/skills', kind: 'cursor-skill' },
  { rel: '.cursor/agents', kind: 'cursor-agent' },
  { rel: '.cursor/commands', kind: 'cursor-command' },
  { rel: '.cursor/hooks', kind: 'hooks-config' },
  { rel: '.claude', kind: 'claude-tree' },
  { rel: '.agents', kind: 'agents-tree' },
];

const MCP_FILES = ['.cursor/mcp.json', '.mcp.json', 'mcp.json'];

export interface DiscoverOptions {
  /** Authored stay globs from `aitools.json` `context.stay`. */
  stay?: string[];
}

function classifyKind(rel: string): AiMechKind {
  const p = toProjectRel(rel);
  const base = path.posix.basename(p);
  if (base === 'AGENTS.md') return 'agents-md';
  if (base === 'CLAUDE.md') return 'claude-md';
  if (p === '.cursor/mcp.json' || p === '.mcp.json' || p === 'mcp.json') return 'mcp-config';
  if (p.startsWith('.cursor/rules/')) return 'cursor-rule';
  if (p.startsWith('.cursor/skills/')) return 'cursor-skill';
  if (p.startsWith('.cursor/agents/')) return 'cursor-agent';
  if (p.startsWith('.cursor/commands/')) return 'cursor-command';
  if (p.startsWith('.cursor/hooks/')) return 'hooks-config';
  if (p.startsWith('.claude/')) return 'claude-tree';
  if (p.startsWith('.agents/')) return 'agents-tree';
  return 'other';
}

function walkFiles(absDir: string, projectRoot: string, out: string[]): void {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      walkFiles(abs, projectRoot, out);
      continue;
    }
    if (!ent.isFile()) continue;
    const rel = toProjectRel(path.relative(projectRoot, abs));
    if (rel && !rel.startsWith('..')) out.push(rel);
  }
}

/**
 * Deterministic catalog of known AI-mech paths under projectRoot.
 * Does not require an LLM.
 */
export function discoverAiMech(projectRoot: string, options: DiscoverOptions = {}): AiMechInventory {
  const root = path.resolve(projectRoot);
  const paths = new Set<string>();

  for (const marker of ROOT_MARKERS) {
    const abs = path.join(root, marker.name);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      paths.add(marker.name);
    }
  }

  for (const mcp of MCP_FILES) {
    const abs = path.join(root, ...mcp.split('/'));
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      paths.add(mcp);
    }
  }

  for (const tree of SCOPED_TREES) {
    const abs = path.join(root, ...tree.rel.split('/'));
    const found: string[] = [];
    walkFiles(abs, root, found);
    for (const f of found) paths.add(f);
  }

  // Nested AGENTS.md / CLAUDE.md one level under subdirs (exclude skipped)
  try {
    for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory() || SKIP_DIR_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
      for (const marker of ROOT_MARKERS) {
        const abs = path.join(root, ent.name, marker.name);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          paths.add(toProjectRel(path.posix.join(ent.name, marker.name)));
        }
      }
    }
  } catch {
    // ignore unreadable root
  }

  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  const entries: AiMechEntry[] = sorted.map((p) => ({
    path: p,
    kind: classifyKind(p),
    stay: isStayPath(p, options.stay),
  }));

  return {
    root,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

/** Paths that should be quarantined for a swap mode. */
export function swappablePaths(
  inventory: AiMechInventory,
  mode: 'replace' | 'overlay',
): string[] {
  if (mode === 'replace') {
    return inventory.entries.map((e) => e.path);
  }
  return inventory.entries.filter((e) => !e.stay).map((e) => e.path);
}

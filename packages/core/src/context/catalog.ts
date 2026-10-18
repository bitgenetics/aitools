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
import type { Catalog, CatalogEntry, CatalogKind } from './types.js';
import { isIgnored, toProjectRel } from './ignore-glob.js';

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

/** Hidden directories that hold AI mechanisms. Every other dot-directory is skipped. */
const WALKED_HIDDEN_DIRS = new Set(['.cursor', '.claude', '.agents', '.github']);

const INSTRUCTION_BASENAMES = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);

interface CatalogRule {
  kind: CatalogKind;
  test: (rel: string, basename: string) => boolean;
}

const exact =
  (...paths: string[]) =>
  (rel: string): boolean =>
    paths.includes(rel);

const under =
  (...prefixes: string[]) =>
  (rel: string): boolean =>
    prefixes.some((p) => rel.startsWith(p + '/'));

/**
 * The one table that defines "what is an AI mechanism". Order matters: the first
 * matching rule wins, so specific trees come before the vendor-tree catch-alls.
 */
const CATALOG_RULES: CatalogRule[] = [
  { kind: 'instructions', test: (_rel, base) => INSTRUCTION_BASENAMES.has(base) },
  { kind: 'instructions', test: exact('.cursorrules', '.windsurfrules', '.github/copilot-instructions.md') },
  { kind: 'rule', test: under('.cursor/rules') },
  { kind: 'skill', test: under('.cursor/skills', '.claude/skills', '.agents/skills') },
  { kind: 'agent', test: under('.cursor/agents', '.claude/agents') },
  { kind: 'command', test: under('.cursor/commands', '.claude/commands') },
  { kind: 'hooks-config', test: (rel) => rel === '.cursor/hooks.json' || under('.cursor/hooks', '.claude/hooks')(rel) },
  { kind: 'mcp-config', test: exact('.cursor/mcp.json', '.mcp.json', 'mcp.json') },
  { kind: 'settings', test: (rel) => /^\.claude\/settings(\.[^/]+)?\.json$/.test(rel) },
  { kind: 'vendor-tree', test: under('.claude', '.agents') },
];

/** Kind of a project-relative path, or null when it is not an AI mechanism. */
export function classify(filePath: string): CatalogKind | null {
  const rel = toProjectRel(filePath);
  const base = path.posix.basename(rel);
  for (const rule of CATALOG_RULES) {
    if (rule.test(rel, base)) return rule.kind;
  }
  return null;
}

function shouldWalk(dirName: string): boolean {
  if (SKIP_DIR_NAMES.has(dirName)) return false;
  if (dirName.startsWith('.')) return WALKED_HIDDEN_DIRS.has(dirName);
  return true;
}

function walkFiles(absDir: string, root: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const abs = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      if (shouldWalk(ent.name)) walkFiles(abs, root, out);
      continue;
    }
    if (ent.isFile()) out.push(toProjectRel(path.relative(root, abs)));
  }
}

/** Deterministic catalog of managed AI-mech paths under root. Does not require an LLM or git. */
export function buildCatalog(root: string, ignore: readonly string[] = []): Catalog {
  const resolvedRoot = path.resolve(root);
  const files: string[] = [];
  walkFiles(resolvedRoot, resolvedRoot, files);

  const entries: CatalogEntry[] = [];
  const ignored: string[] = [];
  for (const rel of files.sort((a, b) => a.localeCompare(b))) {
    const kind = classify(rel);
    if (!kind) continue;
    if (isIgnored(rel, ignore)) ignored.push(rel);
    else entries.push({ path: rel, kind });
  }
  return { root: resolvedRoot, entries, ignored };
}

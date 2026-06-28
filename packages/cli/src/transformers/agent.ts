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
import type { TargetPlatform } from '@bitgenetics/aitools-core';
import type { TransformResult } from './types.js';
import { annotate, nativeResult, unsupportedCategory } from './types.js';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

const CURSOR_ONLY = new Set(['readonly', 'is_background']);
const CLAUDE_ONLY = new Set(['tools', 'skills', 'maxTurns', 'hooks']);
const VSCODE_ONLY = new Set(['prompt', 'mcp-servers']);

function parseFrontmatter(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;
  return { frontmatter: match[1]!, body: match[2] ?? '' };
}

function filterFrontmatterLines(block: string, drop: Set<string>, warnings: string[]): string {
  const kept: string[] = [];
  for (const line of block.split('\n')) {
    if (/^\s/.test(line)) {
      kept.push(line);
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      kept.push(line);
      continue;
    }
    const key = line.slice(0, colonIdx).trim();
    if (drop.has(key)) {
      warnings.push(`Dropped unsupported frontmatter field "${key}"`);
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}

export function transformAgent(
  content: string,
  from: TargetPlatform,
  to: TargetPlatform,
): TransformResult {
  if (to === 'windsurf') {
    return unsupportedCategory('agent', to);
  }

  if (from === to) return nativeResult(content);

  const parsed = parseFrontmatter(content);
  if (!parsed) {
    return { content, confidence: 'medium', warnings: ['No frontmatter to map between agent formats'] };
  }

  const warnings: string[] = [];
  let filtered = parsed.frontmatter;

  if (from === 'cursor' && to === 'claude') {
    filtered = filterFrontmatterLines(filtered, CURSOR_ONLY, warnings);
  } else if (from === 'claude' && to === 'cursor') {
    filtered = filterFrontmatterLines(filtered, CLAUDE_ONLY, warnings);
  } else if (from === 'cursor' && to === 'vscode') {
    filtered = filterFrontmatterLines(filtered, CURSOR_ONLY, warnings);
  } else if (from === 'claude' && to === 'vscode') {
    filtered = filterFrontmatterLines(filtered, CLAUDE_ONLY, warnings);
  }

  const output = `---\n${filtered}\n---\n${parsed.body}`;
  const confidence = warnings.length > 0 ? 'medium' : 'high';
  let destExtension: string | undefined;
  if (to === 'vscode') destExtension = '.agent.md';

  return { content: output, confidence, warnings, destExtension };
}

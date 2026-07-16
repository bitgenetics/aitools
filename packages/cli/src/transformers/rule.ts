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
import { annotateMarkdownIfLossy, nativeResult, passthrough } from './types.js';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseFrontmatter(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;
  return { frontmatter: match[1]!, body: match[2] ?? '' };
}

function parseYamlScalars(block: string): Map<string, string | boolean> {
  const fields = new Map<string, string | boolean>();
  for (const line of block.split('\n')) {
    if (/^\s/.test(line)) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    if (raw === 'true') fields.set(key, true);
    else if (raw === 'false') fields.set(key, false);
    else if (raw.startsWith('>-') || raw === '') continue;
    else fields.set(key, raw.replace(/^['"]|['"]$/g, ''));
  }
  return fields;
}

function serializeFrontmatter(fields: Map<string, string | boolean>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of fields) {
    if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

function renameExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '');
  return `${base}${ext}`;
}

export function transformRule(
  content: string,
  from: TargetPlatform,
  to: TargetPlatform,
): TransformResult {
  if (from === to) return nativeResult(content);

  const parsed = parseFrontmatter(content);
  const body = parsed?.body ?? content;
  const fields = parsed ? parseYamlScalars(parsed.frontmatter) : new Map<string, string | boolean>();
  const warnings: string[] = [];
  let confidence: TransformResult['confidence'] = 'high';
  let destExtension: string | undefined;

  if (from === 'cursor' && to === 'vscode') {
    if (fields.has('globs')) {
      fields.set('applyTo', fields.get('globs') as string);
      fields.delete('globs');
    }
    if (fields.get('alwaysApply') === true) {
      warnings.push('alwaysApply: true has no direct equivalent — use .github/copilot-instructions.md for global rules');
      fields.delete('alwaysApply');
      confidence = 'medium';
    }
    fields.delete('description');
    destExtension = '.instructions.md';
  } else if (from === 'cursor' && to === 'windsurf') {
    if (fields.get('alwaysApply') === true) {
      fields.set('trigger', 'always_on');
      fields.delete('alwaysApply');
    } else if (fields.has('globs')) {
      fields.set('trigger', 'glob');
    }
    destExtension = '.md';
  } else if (from === 'cursor' && to === 'claude') {
    warnings.push('Claude rules are plain markdown — frontmatter scoping is lost');
    return annotateMarkdownIfLossy({
      content: body.trimStart(),
      confidence: 'medium',
      warnings,
      destExtension: '.md',
    });
  } else if (from === 'vscode' && to === 'cursor') {
    if (fields.has('applyTo')) {
      fields.set('globs', fields.get('applyTo') as string);
      fields.delete('applyTo');
    }
    fields.delete('excludeAgent');
    destExtension = '.mdc';
  } else if (to === 'claude') {
    warnings.push('Stripped frontmatter for Claude plain-markdown rules');
    return annotateMarkdownIfLossy({
      content: body.trimStart(),
      confidence: 'medium',
      warnings,
      destExtension: '.md',
    });
  } else {
    return passthrough(content);
  }

  const output = parsed
    ? serializeFrontmatter(fields) + body
    : body;

  return annotateMarkdownIfLossy({ content: output, confidence, warnings, destExtension });
}

export function applyRuleExtension(filename: string, to: TargetPlatform): string | undefined {
  if (to === 'vscode') return renameExtension(filename, '.instructions.md');
  if (to === 'cursor') return renameExtension(filename, '.mdc');
  return undefined;
}

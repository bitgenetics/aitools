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
import { annotate, nativeResult, passthrough } from './types.js';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function hasFrontmatter(content: string): boolean {
  return FRONTMATTER_RE.test(content);
}

function ensureDescriptionFrontmatter(content: string): { content: string; added: boolean } {
  if (hasFrontmatter(content)) return { content, added: false };
  return {
    content: `---\ndescription: Command\n---\n\n${content}`,
    added: true,
  };
}

export function transformCommand(
  content: string,
  from: TargetPlatform,
  to: TargetPlatform,
): TransformResult {
  if (from === to) return nativeResult(content);

  let output = content;
  const warnings: string[] = [];
  let confidence: TransformResult['confidence'] = 'high';
  let destExtension: string | undefined;

  if (from === 'cursor' && to === 'claude') {
    output = content.replace(/\$(\d+)/g, '$ARGUMENTS');
  } else if (from === 'cursor' && to === 'vscode') {
    destExtension = '.prompt.md';
    warnings.push('VS Code supports mode/tools frontmatter not present in Cursor commands');
    confidence = 'medium';
  } else if (from === 'cursor' && to === 'windsurf') {
    const ensured = ensureDescriptionFrontmatter(content);
    output = ensured.content;
    if (ensured.added) {
      warnings.push('Added description frontmatter required by Windsurf workflows');
      confidence = 'medium';
    }
  } else if (from === 'claude' && to === 'cursor') {
    output = content.replace(/\$ARGUMENTS/g, '$1');
  } else if (to === 'vscode' && !content.endsWith('.prompt.md')) {
    destExtension = '.prompt.md';
    confidence = 'medium';
  } else {
    return passthrough(content);
  }

  return { content: output, confidence, warnings, destExtension };
}

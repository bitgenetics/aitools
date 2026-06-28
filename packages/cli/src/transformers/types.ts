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
import type { NormalizedCategory, TargetPlatform } from '@bitgenetics/aitools-core';

export type TransformConfidence = 'native' | 'high' | 'medium' | 'low' | 'unsupported';

export interface TransformResult {
  content: string;
  confidence: TransformConfidence;
  warnings: string[];
  skillPrompt?: string;
  destExtension?: string;
  /** When true, installer should skip writing and recommend an alternate native path. */
  recommendNativePath?: string;
}

export interface TransformContext {
  destPath?: string;
}

export type TransformFn = (
  content: string,
  from: TargetPlatform,
  to: TargetPlatform,
  ctx?: TransformContext,
) => TransformResult;

export function buildSkillPrompt(destPath: string, summary: string): string {
  return `/aitools-convert — review ${destPath}: ${summary}. Annotations inline.`;
}

export function annotate(content: string, note: string): string {
  return `# aitools: ${note}\n${content}`;
}

export function mergeConfidence(a: TransformConfidence, b: TransformConfidence): TransformConfidence {
  const order: TransformConfidence[] = ['native', 'high', 'medium', 'low', 'unsupported'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))]!;
}

export function withSkillPrompt(
  result: TransformResult,
  destPath: string,
  summary: string,
): TransformResult {
  if (result.confidence === 'native' || result.confidence === 'high') {
    return result;
  }
  return {
    ...result,
    skillPrompt: buildSkillPrompt(destPath, summary),
  };
}

export function nativeResult(content: string, destExtension?: string): TransformResult {
  return { content, confidence: 'native', warnings: [], destExtension };
}

export function passthrough(content: string): TransformResult {
  return { content, confidence: 'high', warnings: [] };
}

export function unsupportedCategory(category: NormalizedCategory, to: TargetPlatform): TransformResult {
  return {
    content: '',
    confidence: 'unsupported',
    warnings: [`No ${to} equivalent for category "${category}"`],
    skillPrompt: `/aitools-convert — suggest best approximation for ${category} on ${to}`,
  };
}

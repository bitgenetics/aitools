// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import type { NormalizedCategory, TargetPlatform, ToolCategory } from '@aitools/core';
import { normalizeCategory } from '@aitools/core';
import type { TransformContext, TransformResult } from './types.js';
import { nativeResult, passthrough, unsupportedCategory, withSkillPrompt } from './types.js';
import { transformRule } from './rule.js';
import { transformCommand } from './command.js';
import { transformAgent } from './agent.js';
import { transformHook } from './hook.js';

export type { TransformConfidence, TransformResult, TransformContext } from './types.js';
export { estimateCategoryConfidence, estimateHookConfidence, mergeHookConfigs } from './hook.js';

function applyExtension(filename: string, ext: string | undefined): string {
  if (!ext) return filename;
  const base = filename.replace(/\.[^./\\]+$/, '');
  return `${base}${ext}`;
}

/**
 * Transform tool file content from one platform format to another.
 */
export function transform(
  content: string,
  category: ToolCategory,
  from: TargetPlatform,
  to: TargetPlatform,
  ctx: TransformContext = {},
): TransformResult {
  const { category: normalized } = normalizeCategory(category);

  if (from === to || from === 'universal') {
    return nativeResult(content);
  }

  let result: TransformResult;

  switch (normalized) {
    case 'skill':
    case 'mcp-tool':
      result = passthrough(content);
      break;
    case 'rule':
      result = transformRule(content, from, to);
      break;
    case 'command':
      result = transformCommand(content, from, to);
      break;
    case 'agent':
      result = transformAgent(content, from, to);
      break;
    case 'hook':
      result = transformHook(content, from, to);
      break;
    default:
      result = unsupportedCategory(normalized as NormalizedCategory, to);
  }

  if (result.recommendNativePath) {
    return result;
  }

  if (ctx.destPath && result.confidence !== 'native' && result.confidence !== 'high') {
    const summary =
      result.warnings.length > 0
        ? `${result.warnings.length} items need review (${result.confidence} confidence)`
        : `${result.confidence} confidence transform`;
    result = withSkillPrompt(result, ctx.destPath, summary);
  }

  if (result.destExtension && ctx.destPath) {
    ctx.destPath = applyExtension(ctx.destPath, result.destExtension);
  }

  return result;
}

export function applyDestExtension(filename: string, result: TransformResult): string {
  return applyExtension(filename, result.destExtension);
}

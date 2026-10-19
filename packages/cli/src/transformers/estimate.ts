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
import type { ContentVendor, TargetPlatform, ToolCategory } from '@bitgenetics/aitools-core';
import { isContentVendor, normalizeCategory, vendorHookEvents, writeHooksFile } from '@bitgenetics/aitools-core';
import type { TransformConfidence } from './types.js';
import { transformRule } from './rule.js';
import { transformCommand } from './command.js';
import { transformAgent } from './agent.js';
import { transformHook } from './hook.js';

/**
 * Confidence estimates without file content run the real transformer on a representative
 * fixture written in the source vendor's format with only the fields every vendor shares.
 * The transformer is therefore the single authority for what a platform pair loses.
 */
const RULE_FIXTURE: Record<ContentVendor, string> = {
  cursor: '---\ndescription: Style\nglobs: "*.ts"\n---\nBe tidy.\n',
  vscode: '---\ndescription: Style\napplyTo: "*.ts"\n---\nBe tidy.\n',
  claude: '---\ndescription: Style\npaths:\n  - "*.ts"\n---\nBe tidy.\n',
  windsurf: '---\ndescription: Style\ntrigger: glob\nglobs: "*.ts"\n---\nBe tidy.\n',
};

const COMMAND_FIXTURE = '---\ndescription: Do it\n---\nRun it.\n';

const AGENT_FIXTURE = '---\nname: reviewer\ndescription: Reviews code\n---\nReview the change.\n';

// One command handler on every shared event the source vendor has, so the estimate reflects
// how much of a typical hooks file the target can take.
function hookFixture(from: ContentVendor): string {
  const handler = from === 'windsurf' ? { command: 'echo pre' } : { type: 'command', command: 'echo pre' };
  const events: Record<string, Array<Record<string, unknown>>> = {};
  for (const event of vendorHookEvents(from)) {
    events[event] = from === 'claude' ? [{ hooks: [handler] }] : [handler];
  }
  return writeHooksFile(events, from);
}

/** Estimate hook transform confidence for the compat matrix. */
export function estimateHookConfidence(from: TargetPlatform, to: TargetPlatform): TransformConfidence {
  if (from === to || from === 'universal') return 'native';
  if (!isContentVendor(to)) return 'high';
  return transformHook(hookFixture(from), from, to).confidence;
}

/** Estimate transform confidence for a category and platform pair without file content. */
export function estimateCategoryConfidence(
  category: string,
  from: TargetPlatform,
  to: TargetPlatform,
): TransformConfidence {
  if (from === to || from === 'universal') return 'native';
  if (!isContentVendor(to)) return 'high';
  const { category: normalized } = normalizeCategory(category as ToolCategory);
  switch (normalized) {
    case 'skill':
    case 'mcp-tool':
      return 'high';
    case 'instructions':
      return 'native';
    case 'rule':
      return transformRule(RULE_FIXTURE[from], from, to).confidence;
    case 'command':
      return transformCommand(COMMAND_FIXTURE, from, to).confidence;
    case 'agent':
      return transformAgent(AGENT_FIXTURE, from, to).confidence;
    case 'hook':
      return estimateHookConfidence(from, to);
    default:
      return 'medium';
  }
}

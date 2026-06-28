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
import type { TargetPlatform } from '@aitools/core';
import type { TransformResult } from './types.js';
import { annotate, mergeConfidence, nativeResult } from './types.js';

/** Events with approximate cross-platform support. */
export const PORTABLE_HOOK_EVENTS = new Set([
  'preToolUse',
  'postToolUse',
  'sessionStart',
  'sessionEnd',
  'subagentStart',
  'subagentStop',
]);

const CURSOR_SPECIFIC = new Set([
  'beforeShellExecution', 'afterShellExecution', 'beforeMCPExecution', 'afterMCPExecution',
  'beforeReadFile', 'afterFileEdit', 'beforeSubmitPrompt', 'stop', 'afterAgentResponse',
  'afterAgentThought', 'beforeTabFileRead', 'afterTabFileEdit', 'workspaceOpen',
  'postToolUseFailure', 'preCompact',
]);

const CLAUDE_SPECIFIC = new Set([
  'Setup', 'UserPromptExpansion', 'PostToolBatch', 'PermissionRequest', 'PermissionDenied',
  'TaskCreated', 'TaskCompleted', 'TeammateIdle', 'InstructionsLoaded', 'ConfigChange',
  'CwdChanged', 'FileChanged', 'WorktreeCreate', 'WorktreeRemove', 'PostCompact',
  'Elicitation', 'ElicitationResult', 'StopFailure', 'MessageDisplay', 'Stop', 'Notification',
]);

const COPILOT_SPECIFIC = new Set([
  'userPromptSubmitted', 'notification', 'permissionRequest', 'preCompact',
  'errorOccurred', 'agentStop', 'postToolUseFailure',
]);

/** Map camelCase shared events to PascalCase (Claude/VS Code local). */
const CAMEL_TO_PASCAL: Record<string, string> = {
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
  sessionStart: 'SessionStart',
  sessionEnd: 'SessionEnd',
  subagentStart: 'SubagentStart',
  subagentStop: 'SubagentStop',
};

const PASCAL_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_PASCAL).map(([k, v]) => [v, k]),
);

/** Map camelCase to snake_case for Windsurf. */
const CAMEL_TO_SNAKE: Record<string, string> = {
  preToolUse: 'pre_tool_use',
  postToolUse: 'post_tool_use',
  sessionStart: 'session_start',
  sessionEnd: 'session_end',
  subagentStart: 'subagent_start',
  subagentStop: 'subagent_stop',
};

type HookHandler = Record<string, unknown>;
type HookConfig = Record<string, HookHandler[]>;

function isPlatformSpecificEvent(event: string, from: TargetPlatform): boolean {
  if (CURSOR_SPECIFIC.has(event)) return from === 'cursor';
  if (CLAUDE_SPECIFIC.has(event)) return from === 'claude';
  if (COPILOT_SPECIFIC.has(event)) return from === 'vscode';
  return false;
}

function mapEventName(event: string, to: TargetPlatform): string {
  if (to === 'claude') {
    return CAMEL_TO_PASCAL[event] ?? PASCAL_TO_CAMEL[event] ?? event;
  }
  if (to === 'vscode') {
    // Copilot CLI format uses camelCase
    return PASCAL_TO_CAMEL[event] ?? event;
  }
  if (to === 'windsurf') {
    return CAMEL_TO_SNAKE[event] ?? CAMEL_TO_SNAKE[PASCAL_TO_CAMEL[event] ?? ''] ?? event;
  }
  return PASCAL_TO_CAMEL[event] ?? event;
}

function transformHandler(handler: HookHandler, from: TargetPlatform, to: TargetPlatform, warnings: string[]): HookHandler | null {
  const type = handler['type'] as string | undefined;

  if (type === 'prompt') {
    warnings.push('Dropped prompt-type hook — semantics differ across platforms');
    return null;
  }
  if (type === 'mcp_tool' || type === 'agent') {
    warnings.push(`Dropped ${type}-type hook — not supported on ${to}`);
    return null;
  }
  if (type === 'http' && (to === 'cursor' || to === 'windsurf')) {
    warnings.push('Dropped http-type hook — not supported on target platform');
    return null;
  }

  const result = { ...handler };

  if (from === 'cursor' && to === 'claude') {
    if (typeof result['command'] === 'string') {
      result['command'] = result['command'];
    }
  }

  return result;
}

function extractHooks(content: string, from: TargetPlatform): HookConfig {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  if (from === 'claude') {
    const hooks = parsed['hooks'];
    if (hooks && typeof hooks === 'object') return hooks as HookConfig;
    return {};
  }
  return parsed as HookConfig;
}

function wrapHooks(hooks: HookConfig, to: TargetPlatform): string {
  if (to === 'claude') {
    return JSON.stringify({ hooks }, null, 2) + '\n';
  }
  return JSON.stringify(hooks, null, 2) + '\n';
}

export function transformHook(
  content: string,
  from: TargetPlatform,
  to: TargetPlatform,
): TransformResult {
  if (from === 'claude' && (to === 'cursor' || to === 'vscode')) {
    return {
      content,
      confidence: 'native',
      warnings: [],
      recommendNativePath: '.claude/settings.json — Cursor and Copilot load Claude hooks natively',
    };
  }

  if (from === to) return nativeResult(content);

  const warnings: string[] = [];
  let confidence: TransformResult['confidence'] = 'medium';

  let input: HookConfig;
  try {
    input = extractHooks(content, from);
  } catch {
    return {
      content,
      confidence: 'unsupported',
      warnings: ['Invalid hook JSON'],
      skillPrompt: '/aitools-convert — fix malformed hook config',
    };
  }

  const output: HookConfig = {};

  for (const [event, handlers] of Object.entries(input)) {
    if (!Array.isArray(handlers)) continue;

    if (isPlatformSpecificEvent(event, from) || (!PORTABLE_HOOK_EVENTS.has(event) && !PORTABLE_HOOK_EVENTS.has(PASCAL_TO_CAMEL[event] ?? ''))) {
      warnings.push(`Dropped platform-specific event "${event}"`);
      confidence = mergeConfidence(confidence, 'low');
      continue;
    }

    const mappedEvent = mapEventName(event, to);
    const transformedHandlers: HookHandler[] = [];

    for (const handler of handlers) {
      const mapped = transformHandler(handler, from, to, warnings);
      if (mapped) transformedHandlers.push(mapped);
    }

    if (transformedHandlers.length > 0) {
      output[mappedEvent] = transformedHandlers;
    }
  }

  if (Object.keys(output).length === 0) {
    return {
      content: annotate('{}', 'No portable hook events survived transformation'),
      confidence: 'unsupported',
      warnings,
      skillPrompt: '/aitools-convert — no portable hooks remained after transformation',
    };
  }

  if (warnings.length > 3) confidence = 'low';

  const resultContent = wrapHooks(output, to);
  return { content: resultContent, confidence, warnings };
}

/** Merge hook configs for install. Claude uses settings.json wrapper. */
export function mergeHookConfigs(
  existingContent: string | null,
  incomingContent: string,
  platform: TargetPlatform,
): string {
  const parseExisting = (): HookConfig => {
    if (!existingContent) return {};
    try {
      const parsed = JSON.parse(existingContent) as Record<string, unknown>;
      if (platform === 'claude') {
        return (parsed['hooks'] as HookConfig) ?? {};
      }
      return parsed as HookConfig;
    } catch {
      return {};
    }
  };

  const existing = parseExisting();
  const incoming = extractHooks(incomingContent, platform);

  for (const [event, handlers] of Object.entries(incoming)) {
    if (!Array.isArray(handlers)) continue;
    const current = existing[event] ?? [];
    existing[event] = [...current, ...handlers];
  }

  if (platform === 'claude') {
    let settings: Record<string, unknown> = {};
    if (existingContent) {
      try {
        settings = JSON.parse(existingContent) as Record<string, unknown>;
      } catch {
        settings = {};
      }
    }
    settings['hooks'] = existing;
    return JSON.stringify(settings, null, 2) + '\n';
  }

  return JSON.stringify(existing, null, 2) + '\n';
}

/** Estimate transform confidence for compat matrix without file content. */
export function estimateHookConfidence(from: TargetPlatform, to: TargetPlatform): TransformResult['confidence'] {
  if (from === to) return 'native';
  if (from === 'claude' && (to === 'cursor' || to === 'vscode')) return 'native';
  if (to === 'windsurf') return 'low';
  if (from === 'cursor' && to === 'claude') return 'low';
  if (from === 'claude' && to === 'vscode') return 'medium';
  return 'medium';
}

export function estimateCategoryConfidence(
  category: string,
  from: TargetPlatform,
  to: TargetPlatform,
): TransformResult['confidence'] {
  if (from === to || from === 'universal') return 'native';
  switch (category) {
    case 'skill':
    case 'mcp-tool':
      return 'high';
    case 'rule':
      if ((from === 'cursor' && to === 'vscode') || (from === 'vscode' && to === 'cursor')) return 'high';
      if (to === 'claude') return 'medium';
      return 'medium';
    case 'command':
      if (from === 'cursor' && to === 'claude') return 'high';
      return 'medium';
    case 'agent':
      if (to === 'windsurf') return 'unsupported';
      return 'medium';
    case 'hook':
      return estimateHookConfidence(from, to);
    default:
      return 'medium';
  }
}

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
import type { ContentVendor } from './types.js';

export type HookHandler = Record<string, unknown>;
/** Event name -> handler list, in the vendor's own naming. */
export type HookEvents = Record<string, HookHandler[]>;

/**
 * Hook events with an equivalent on more than one vendor, keyed by a vendor-neutral name.
 * Verified 2026-10-19 against each vendor's hooks page:
 * Cursor camelCase in `.cursor/hooks.json` `{ version: 1, hooks }`; Claude Code PascalCase
 * under the `hooks` key of settings.json; VS Code PascalCase in `.github/hooks/*.json`
 * `{ hooks }`; Windsurf snake_case per tool kind in `.devin/hooks.json` `{ hooks }`.
 */
export const HOOK_EVENTS: Record<string, Record<ContentVendor, string | null>> = {
  PreToolUse:         { cursor: 'preToolUse',           claude: 'PreToolUse',         vscode: 'PreToolUse',       windsurf: null },
  PostToolUse:        { cursor: 'postToolUse',          claude: 'PostToolUse',        vscode: 'PostToolUse',      windsurf: null },
  PostToolUseFailure: { cursor: 'postToolUseFailure',   claude: 'PostToolUseFailure', vscode: null,               windsurf: null },
  SessionStart:       { cursor: 'sessionStart',         claude: 'SessionStart',       vscode: 'SessionStart',     windsurf: null },
  SessionEnd:         { cursor: 'sessionEnd',           claude: 'SessionEnd',         vscode: null,               windsurf: null },
  SubagentStart:      { cursor: 'subagentStart',        claude: 'SubagentStart',      vscode: 'SubagentStart',    windsurf: null },
  SubagentStop:       { cursor: 'subagentStop',         claude: 'SubagentStop',       vscode: 'SubagentStop',     windsurf: null },
  Stop:               { cursor: 'stop',                 claude: 'Stop',               vscode: 'Stop',             windsurf: null },
  PreCompact:         { cursor: 'preCompact',           claude: 'PreCompact',         vscode: 'PreCompact',       windsurf: null },
  UserPromptSubmit:   { cursor: 'beforeSubmitPrompt',   claude: 'UserPromptSubmit',   vscode: 'UserPromptSubmit', windsurf: 'pre_user_prompt' },
  PreShellExecution:  { cursor: 'beforeShellExecution', claude: null,                 vscode: null,               windsurf: 'pre_run_command' },
  PostShellExecution: { cursor: 'afterShellExecution',  claude: null,                 vscode: null,               windsurf: 'post_run_command' },
  PreMcpExecution:    { cursor: 'beforeMCPExecution',   claude: null,                 vscode: null,               windsurf: 'pre_mcp_tool_use' },
  PostMcpExecution:   { cursor: 'afterMCPExecution',    claude: null,                 vscode: null,               windsurf: 'post_mcp_tool_use' },
  PreReadFile:        { cursor: 'beforeReadFile',       claude: null,                 vscode: null,               windsurf: 'pre_read_code' },
  PostFileEdit:       { cursor: 'afterFileEdit',        claude: null,                 vscode: null,               windsurf: 'post_write_code' },
  AgentResponse:      { cursor: 'afterAgentResponse',   claude: null,                 vscode: null,               windsurf: 'post_cascade_response' },
};

/** The vendor's name for a neutral event, or null when the vendor has no such event. */
export function hookEventName(neutral: string, vendor: ContentVendor): string | null {
  return HOOK_EVENTS[neutral]?.[vendor] ?? null;
}

/** The neutral name for a vendor's event name, or null when it is vendor-specific. */
export function neutralHookEvent(name: string, vendor: ContentVendor): string | null {
  for (const [neutral, names] of Object.entries(HOOK_EVENTS)) {
    if (names[vendor] === name) return neutral;
  }
  return null;
}

/** Every event name the vendor has in the shared table, in the vendor's spelling. */
export function vendorHookEvents(vendor: ContentVendor): string[] {
  const names: string[] = [];
  for (const byVendor of Object.values(HOOK_EVENTS)) {
    const name = byVendor[vendor];
    if (name) names.push(name);
  }
  return names;
}

/** Hook file split into its event map and the other top-level keys the file carries. */
export interface HooksFile {
  events: HookEvents;
  rest: Record<string, unknown>;
}

const CURSOR_HOOKS_FILE_VERSION = 1;

function isEventMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function eventsFrom(map: Record<string, unknown>): HookEvents {
  const events: HookEvents = {};
  for (const [event, handlers] of Object.entries(map)) {
    if (Array.isArray(handlers)) events[event] = handlers as HookHandler[];
  }
  return events;
}

/**
 * Parse a vendor hooks file. Throws on invalid JSON.
 * Every vendor wraps events under `hooks`; a flat event map is accepted as legacy input
 * for the vendors whose file holds nothing else.
 */
export function readHooksFile(content: string, vendor: ContentVendor): HooksFile {
  const parsed = JSON.parse(content) as unknown;
  if (!isEventMap(parsed)) return { events: {}, rest: {} };
  const { hooks, ...rest } = parsed;
  if (isEventMap(hooks)) {
    return { events: eventsFrom(hooks), rest };
  }
  if (vendor === 'claude') return { events: {}, rest: parsed };
  return { events: eventsFrom(parsed), rest: {} };
}

/** Serialize events in the shape the vendor reads, keeping unrelated top-level keys. */
export function writeHooksFile(events: HookEvents, vendor: ContentVendor, rest: Record<string, unknown> = {}): string {
  const file: Record<string, unknown> =
    vendor === 'cursor'
      ? { version: CURSOR_HOOKS_FILE_VERSION, ...rest, hooks: events }
      : { ...rest, hooks: events };
  return JSON.stringify(file, null, 2) + '\n';
}

/** Hook events from a vendor hooks file, omitting events with no handlers. */
export function nonEmptyHookEvents(content: string, vendor: ContentVendor): HookEvents {
  const out: HookEvents = {};
  for (const [event, handlers] of Object.entries(readHooksFile(content, vendor).events)) {
    if (handlers.length > 0) out[event] = handlers;
  }
  return out;
}

// -- Handler shapes ----------------------------------------------------------

/** Claude groups handlers as `{ matcher?, hooks: [handler] }`; other vendors list handlers flat. */
function flattenHandlers(handlers: HookHandler[], from: ContentVendor): HookHandler[] {
  if (from !== 'claude') return handlers;
  const flat: HookHandler[] = [];
  for (const entry of handlers) {
    const inner = entry['hooks'];
    if (!Array.isArray(inner)) {
      flat.push(entry);
      continue;
    }
    for (const handler of inner as HookHandler[]) {
      flat.push(entry['matcher'] === undefined ? handler : { ...handler, matcher: entry['matcher'] });
    }
  }
  return flat;
}

/** Regroup flat handlers into Claude's matcher groups, one group per distinct matcher. */
function groupForClaude(handlers: HookHandler[]): HookHandler[] {
  const groups = new Map<string | undefined, HookHandler[]>();
  for (const handler of handlers) {
    const { matcher, ...rest } = handler;
    const key = typeof matcher === 'string' ? matcher : undefined;
    const list = groups.get(key) ?? [];
    list.push(rest);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([matcher, hooks]) =>
    matcher === undefined ? { hooks } : { matcher, hooks },
  );
}

/**
 * Windsurf handlers are `{ command, powershell?, show_output?, working_directory? }` with
 * no `type`; every other vendor writes `{ type: 'command', command, ... }`.
 */
function fromWindsurfHandler(handler: HookHandler, warnings: string[]): HookHandler | null {
  const command = handler['command'];
  if (typeof command !== 'string') {
    warnings.push('Dropped Windows-only hook: it has a powershell command but no shell command');
    return null;
  }
  return { type: 'command', command };
}

function toWindsurfHandler(handler: HookHandler, warnings: string[]): HookHandler | null {
  const command = handler['command'];
  if (typeof command !== 'string') {
    warnings.push('Dropped hook without a shell command: Windsurf hooks run commands only');
    return null;
  }
  if (handler['matcher'] !== undefined) {
    warnings.push('Dropped hook matcher: Windsurf events are already per tool kind');
  }
  return { command };
}

/** Drop handler types the target cannot run; returns null when the handler is dropped. */
function portableHandler(handler: HookHandler, to: ContentVendor, warnings: string[]): HookHandler | null {
  const type = handler['type'];
  if (type === 'prompt') {
    warnings.push('Dropped prompt-type hook: semantics differ across platforms');
    return null;
  }
  if (type === 'mcp_tool' || type === 'agent') {
    warnings.push(`Dropped ${type}-type hook: not supported on ${to}`);
    return null;
  }
  if (type === 'http' && (to === 'cursor' || to === 'windsurf')) {
    warnings.push('Dropped http-type hook: not supported on target platform');
    return null;
  }
  if (to === 'vscode' && handler['matcher'] !== undefined) {
    warnings.push('Dropped hook matcher: VS Code hooks apply to every tool');
    const { matcher: _matcher, ...rest } = handler;
    return rest;
  }
  return handler;
}

function convertHandler(
  handler: HookHandler,
  from: ContentVendor,
  to: ContentVendor,
  warnings: string[],
): HookHandler | null {
  const neutral = from === 'windsurf' ? fromWindsurfHandler(handler, warnings) : handler;
  if (!neutral) return null;
  const portable = portableHandler(neutral, to, warnings);
  if (!portable) return null;
  return to === 'windsurf' ? toWindsurfHandler(portable, warnings) : portable;
}

export interface HookConversion {
  events: HookEvents;
  warnings: string[];
  /** True when no event survived; `events` is empty. */
  unsupported: boolean;
}

export const NO_PORTABLE_HOOKS_WARNING = 'No portable hook events survived transformation';

/** Convert events parsed from a `from` hooks file into the `to` vendor's events. */
export function convertHookEvents(input: HookEvents, from: ContentVendor, to: ContentVendor): HookConversion {
  const warnings: string[] = [];
  const events: HookEvents = {};
  for (const [event, handlers] of Object.entries(input)) {
    const neutral = neutralHookEvent(event, from);
    const target = neutral ? hookEventName(neutral, to) : null;
    if (!target) {
      warnings.push(`Dropped platform-specific event "${event}"`);
      continue;
    }
    const kept: HookHandler[] = [];
    for (const handler of flattenHandlers(handlers, from)) {
      const converted = convertHandler(handler, from, to, warnings);
      if (converted) kept.push(converted);
    }
    if (kept.length === 0) continue;
    events[target] = to === 'claude' ? groupForClaude(kept) : kept;
  }
  if (Object.keys(events).length === 0) {
    warnings.push(NO_PORTABLE_HOOKS_WARNING);
    return { events, warnings, unsupported: true };
  }
  return { events, warnings, unsupported: false };
}

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
import {
  convertHookEvents,
  hookEventName,
  neutralHookEvent,
  readHooksFile,
  vendorHookEvents,
  writeHooksFile,
  NO_PORTABLE_HOOKS_WARNING,
} from './hooks.js';

const CMD = { type: 'command', command: 'echo hi' };

describe('hook event names', () => {
  it('maps the neutral PreToolUse to each vendor spelling', () => {
    expect([
      hookEventName('PreToolUse', 'cursor'),
      hookEventName('PreToolUse', 'claude'),
      hookEventName('PreToolUse', 'vscode'),
    ]).toEqual(['preToolUse', 'PreToolUse', 'PreToolUse']);
  });

  it('returns null for an event the vendor does not have', () => {
    expect(hookEventName('SessionEnd', 'vscode')).toBeNull();
  });

  it('resolves a vendor spelling back to the neutral name', () => {
    expect(neutralHookEvent('beforeSubmitPrompt', 'cursor')).toBe('UserPromptSubmit');
  });
});

describe('readHooksFile', () => {
  it('reads the versioned cursor shape', () => {
    const file = readHooksFile(JSON.stringify({ version: 1, hooks: { preToolUse: [CMD] } }), 'cursor');
    expect(file.events).toEqual({ preToolUse: [CMD] });
  });

  it('reads a flat legacy event map', () => {
    const file = readHooksFile(JSON.stringify({ preToolUse: [CMD] }), 'cursor');
    expect(file.events).toEqual({ preToolUse: [CMD] });
  });

  it('keeps the other settings keys of a claude settings file', () => {
    const file = readHooksFile(JSON.stringify({ model: 'sonnet', hooks: { PreToolUse: [CMD] } }), 'claude');
    expect(file.rest).toEqual({ model: 'sonnet' });
  });

  it('reads no events from a claude settings file without hooks', () => {
    expect(readHooksFile(JSON.stringify({ model: 'sonnet' }), 'claude').events).toEqual({});
  });
});

describe('writeHooksFile', () => {
  it('writes cursor hooks with the file version', () => {
    expect(JSON.parse(writeHooksFile({ preToolUse: [CMD] }, 'cursor'))).toEqual({
      version: 1,
      hooks: { preToolUse: [CMD] },
    });
  });

  it('writes claude hooks next to the other settings keys', () => {
    expect(JSON.parse(writeHooksFile({ PreToolUse: [CMD] }, 'claude', { model: 'sonnet' }))).toEqual({
      model: 'sonnet',
      hooks: { PreToolUse: [CMD] },
    });
  });

  it('writes windsurf hooks under the hooks key', () => {
    expect(JSON.parse(writeHooksFile({ pre_run_command: [{ command: 'echo hi' }] }, 'windsurf'))).toEqual({
      hooks: { pre_run_command: [{ command: 'echo hi' }] },
    });
  });
});

describe('convertHookEvents', () => {
  it('renames cursor events to the vscode spelling', () => {
    const result = convertHookEvents({ preToolUse: [CMD] }, 'cursor', 'vscode');
    expect(result.events).toEqual({ PreToolUse: [CMD] });
  });

  it('flattens claude matcher groups for cursor', () => {
    const result = convertHookEvents({ PreToolUse: [{ matcher: 'Write', hooks: [CMD] }] }, 'claude', 'cursor');
    expect(result.events).toEqual({ preToolUse: [{ ...CMD, matcher: 'Write' }] });
  });

  it('groups cursor handlers with a matcher for claude', () => {
    const result = convertHookEvents({ preToolUse: [{ ...CMD, matcher: 'Write' }] }, 'cursor', 'claude');
    expect(result.events).toEqual({ PreToolUse: [{ matcher: 'Write', hooks: [CMD] }] });
  });

  it('drops the matcher for vscode with a warning', () => {
    const result = convertHookEvents({ preToolUse: [{ ...CMD, matcher: 'Write' }] }, 'cursor', 'vscode');
    expect(result.events).toEqual({ PreToolUse: [CMD] });
  });

  it('drops events the target vendor does not have', () => {
    const result = convertHookEvents({ sessionEnd: [CMD] }, 'cursor', 'vscode');
    expect(result.warnings).toEqual([expect.stringContaining('"sessionEnd"'), NO_PORTABLE_HOOKS_WARNING]);
  });

  it('is unsupported when nothing portable remains', () => {
    const result = convertHookEvents({ beforeShellExecution: [CMD] }, 'cursor', 'claude');
    expect(result.unsupported).toBe(true);
  });

  it('maps the cursor shell event to windsurf with a command-only handler', () => {
    const result = convertHookEvents({ beforeShellExecution: [{ ...CMD, timeout: 5 }] }, 'cursor', 'windsurf');
    expect(result.events).toEqual({ pre_run_command: [{ command: 'echo hi' }] });
  });

  it('has no windsurf equivalent for the generic tool events', () => {
    const result = convertHookEvents({ preToolUse: [CMD] }, 'cursor', 'windsurf');
    expect(result.unsupported).toBe(true);
  });

  it('reads a windsurf handler back into the typed command shape', () => {
    const handler = { command: 'echo hi', powershell: 'Write-Host hi', show_output: true };
    const result = convertHookEvents({ post_write_code: [handler] }, 'windsurf', 'cursor');
    expect(result.events).toEqual({ afterFileEdit: [CMD] });
  });

  it('drops a windsurf handler that has only a powershell command', () => {
    const result = convertHookEvents({ pre_user_prompt: [{ powershell: 'Write-Host hi' }] }, 'windsurf', 'claude');
    expect(result.warnings).toEqual([expect.stringContaining('powershell'), NO_PORTABLE_HOOKS_WARNING]);
  });

  it('lists every shared event a vendor has in its own spelling', () => {
    expect(vendorHookEvents('windsurf')).toEqual([
      'pre_user_prompt',
      'pre_run_command',
      'post_run_command',
      'pre_mcp_tool_use',
      'post_mcp_tool_use',
      'pre_read_code',
      'post_write_code',
      'post_cascade_response',
    ]);
  });

  it('drops prompt handlers', () => {
    const result = convertHookEvents({ preToolUse: [{ type: 'prompt', prompt: 'x' }] }, 'cursor', 'claude');
    expect(result.unsupported).toBe(true);
  });
});

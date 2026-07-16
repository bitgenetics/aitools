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
import { transformRule, applyRuleExtension } from './rule.js';
import { transformCommand } from './command.js';
import { transformAgent } from './agent.js';
import {
  transformHook,
  mergeHookConfigs,
  unmergeHookConfigs,
  extractHooksAdded,
  estimateCategoryConfidence,
  estimateHookConfidence,
} from './hook.js';
import { transform, applyDestExtension } from './index.js';

describe('transformRule', () => {
  it('returns native when from equals to', () => {
    expect(transformRule('content', 'cursor', 'cursor').confidence).toBe('native');
  });

  it('maps cursor globs to vscode applyTo', () => {
    const input = `---\nglobs: src/**\nalwaysApply: false\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'vscode');
    expect(result.confidence).toBe('high');
    expect(result.content).toContain('applyTo: src/**');
    expect(result.destExtension).toBe('.instructions.md');
  });

  it('warns when alwaysApply is true for cursor to vscode', () => {
    const input = `---\nalwaysApply: true\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'vscode');
    expect(result.confidence).toBe('medium');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.content).toContain('# aitools:');
  });

  it('maps cursor alwaysApply to windsurf trigger always_on', () => {
    const input = `---\nalwaysApply: true\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'windsurf');
    expect(result.content).toContain('trigger: always_on');
  });

  it('maps cursor globs to windsurf trigger glob', () => {
    const input = `---\nglobs: src/**\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'windsurf');
    expect(result.content).toContain('trigger: glob');
  });

  it('strips frontmatter when targeting claude from cursor', () => {
    const input = `---\nglobs: src/**\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'claude');
    expect(result.confidence).toBe('medium');
    expect(result.content).toContain('# aitools:');
    expect(result.content).toContain('# Rule body');
  });

  it('maps vscode applyTo to cursor globs', () => {
    const input = `---\napplyTo: src/**\nexcludeAgent: foo\n---\n# Rule body`;
    const result = transformRule(input, 'vscode', 'cursor');
    expect(result.content).toContain('globs: src/**');
    expect(result.content).not.toContain('excludeAgent');
    expect(result.destExtension).toBe('.mdc');
  });

  it('strips frontmatter for vscode to claude', () => {
    const input = `---\napplyTo: src/**\n---\n# Rule body`;
    const result = transformRule(input, 'vscode', 'claude');
    expect(result.content).toContain('# aitools:');
    expect(result.content).toContain('# Rule body');
  });

  it('passes through unrecognized platform pairs', () => {
    const input = 'plain rule without frontmatter';
    const result = transformRule(input, 'windsurf', 'vscode');
    expect(result.confidence).toBe('high');
    expect(result.content).toBe(input);
  });
});

describe('applyRuleExtension', () => {
  it('returns vscode instructions extension', () => {
    expect(applyRuleExtension('rule.mdc', 'vscode')).toBe('rule.instructions.md');
  });

  it('returns cursor mdc extension', () => {
    expect(applyRuleExtension('rule.md', 'cursor')).toBe('rule.mdc');
  });
});

describe('transformCommand', () => {
  it('returns native when from equals to', () => {
    expect(transformCommand('x', 'cursor', 'cursor').confidence).toBe('native');
  });

  it('maps cursor $1 to claude $ARGUMENTS', () => {
    const result = transformCommand('Run lint on $1', 'cursor', 'claude');
    expect(result.content).toBe('Run lint on $ARGUMENTS');
    expect(result.confidence).toBe('high');
  });

  it('adds prompt extension for cursor to vscode', () => {
    const result = transformCommand('# Cmd', 'cursor', 'vscode');
    expect(result.destExtension).toBe('.prompt.md');
    expect(result.confidence).toBe('medium');
    expect(result.content).toContain('# aitools:');
  });

  it('adds description frontmatter for cursor to windsurf when missing', () => {
    const result = transformCommand('# Cmd', 'cursor', 'windsurf');
    expect(result.content).toContain('description: Command');
    expect(result.confidence).toBe('medium');
    expect(result.content).toContain('# aitools:');
  });

  it('maps claude $ARGUMENTS to cursor $1', () => {
    const result = transformCommand('Run $ARGUMENTS', 'claude', 'cursor');
    expect(result.content).toBe('Run $1');
  });

  it('adds prompt extension for claude to vscode', () => {
    const result = transformCommand('# Cmd', 'claude', 'vscode');
    expect(result.destExtension).toBe('.prompt.md');
  });

  it('passes through other platform pairs', () => {
    const result = transformCommand('# Cmd', 'windsurf', 'claude');
    expect(result.confidence).toBe('high');
  });
});

describe('transformAgent', () => {
  it('returns unsupported for windsurf target', () => {
    const input = `---\nname: my-agent\ndescription: test\n---\nBody`;
    const result = transformAgent(input, 'cursor', 'windsurf');
    expect(result.confidence).toBe('unsupported');
  });

  it('returns native when from equals to', () => {
    expect(transformAgent('body', 'cursor', 'cursor').confidence).toBe('native');
  });

  it('returns medium confidence when frontmatter is missing', () => {
    const result = transformAgent('Body only', 'cursor', 'claude');
    expect(result.confidence).toBe('medium');
    expect(result.warnings[0]).toContain('No frontmatter');
    expect(result.content).toContain('# aitools:');
  });

  it('drops cursor-only fields when targeting claude', () => {
    const input = `---\nname: my-agent\nreadonly: true\nmodel: sonnet\n---\nBody`;
    const result = transformAgent(input, 'cursor', 'claude');
    expect(result.content).not.toMatch(/^readonly:/m);
    expect(result.content).not.toContain('\nreadonly:');
    expect(result.warnings.some((w) => w.includes('readonly'))).toBe(true);
    expect(result.content).toContain('# aitools:');
  });

  it('drops claude-only fields when targeting cursor', () => {
    const input = `---\nname: my-agent\ntools: []\nmaxTurns: 3\n---\nBody`;
    const result = transformAgent(input, 'claude', 'cursor');
    expect(result.content).not.toContain('\nmaxTurns:');
  });

  it('adds agent extension for vscode target', () => {
    const input = `---\nname: my-agent\n---\nBody`;
    const result = transformAgent(input, 'cursor', 'vscode');
    expect(result.destExtension).toBe('.agent.md');
  });

  it('drops claude-only fields when targeting vscode', () => {
    const input = `---\nname: my-agent\nskills: []\n---\nBody`;
    const result = transformAgent(input, 'claude', 'vscode');
    expect(result.content).not.toContain('\nskills:');
  });
});

describe('transformHook', () => {
  it('recommends native path for claude to cursor', () => {
    const input = JSON.stringify({ PreToolUse: [{ type: 'command', command: 'echo hi' }] });
    const result = transformHook(input, 'claude', 'cursor');
    expect(result.confidence).toBe('native');
    expect(result.recommendNativePath).toContain('.claude/settings.json');
  });

  it('returns native when from equals to', () => {
    const input = JSON.stringify({ preToolUse: [] });
    expect(transformHook(input, 'cursor', 'cursor').confidence).toBe('native');
  });

  it('returns unsupported for invalid JSON', () => {
    const result = transformHook('not json', 'cursor', 'claude');
    expect(result.confidence).toBe('unsupported');
    expect(result.warnings).toContain('Invalid hook JSON');
  });

  it('keeps portable events when transforming cursor to vscode', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo hi' }],
      beforeShellExecution: [{ type: 'command', command: 'echo drop' }],
    });
    const result = transformHook(input, 'cursor', 'vscode');
    expect(result.content).toContain('preToolUse');
    expect(result.content).not.toContain('beforeShellExecution');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('drops prompt-type hooks during transformation', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'prompt', prompt: 'check this' }],
    });
    const result = transformHook(input, 'cursor', 'vscode');
    expect(result.warnings.some((w) => w.includes('prompt-type'))).toBe(true);
  });

  it('drops http hooks when targeting windsurf', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'http', url: 'https://example.com/hook' }],
    });
    const result = transformHook(input, 'cursor', 'windsurf');
    expect(result.warnings.some((w) => w.includes('http-type'))).toBe(true);
  });

  it('drops mcp_tool hooks during transformation', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'mcp_tool', tool: 'search' }],
    });
    const result = transformHook(input, 'cursor', 'windsurf');
    expect(result.warnings.some((w) => w.includes('mcp_tool'))).toBe(true);
  });

  it('maps events to snake_case for windsurf', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo hi' }],
    });
    const result = transformHook(input, 'cursor', 'windsurf');
    expect(result.content).toContain('pre_tool_use');
  });

  it('returns unsupported when no portable events remain', () => {
    const input = JSON.stringify({
      beforeShellExecution: [{ type: 'command', command: 'x' }],
    });
    const result = transformHook(input, 'cursor', 'claude');
    expect(result.confidence).toBe('unsupported');
    expect(result.content).toBe('');
    expect(result.content).not.toContain('# aitools:');
    expect(result.warnings).toContain('No portable hook events survived transformation');
  });

  it('returns unsupported for malformed hook JSON', () => {
    const result = transformHook('{ not json', 'cursor', 'vscode');
    expect(result.confidence).toBe('unsupported');
    expect(result.content).toBe('');
    expect(result.warnings).toContain('Invalid hook JSON');
  });

  it('drops agent-type hooks during transformation', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'agent', agent: 'reviewer' }],
    });
    const result = transformHook(input, 'cursor', 'claude');
    expect(result.warnings.some((w) => w.includes('agent-type'))).toBe(true);
  });

  it('transforms claude hook config wrapped in settings.json', () => {
    const input = JSON.stringify({
      hooks: { PreToolUse: [{ type: 'command', command: 'echo hi' }] },
    });
    const result = transformHook(input, 'claude', 'windsurf');
    expect(result.content).toContain('pre_tool_use');
  });

  it('preserves command hooks when transforming cursor to claude', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo hi' }],
    });
    const result = transformHook(input, 'cursor', 'claude');
    expect(result.content).toContain('PreToolUse');
    expect(result.content).toContain('echo hi');
  });

  it('lowers confidence when many warnings accumulate', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo ok' }],
      beforeShellExecution: [{ type: 'command', command: 'a' }],
      afterShellExecution: [{ type: 'command', command: 'b' }],
      beforeMCPExecution: [{ type: 'command', command: 'c' }],
      afterMCPExecution: [{ type: 'command', command: 'd' }],
    });
    const result = transformHook(input, 'cursor', 'vscode');
    expect(result.confidence).toBe('low');
    expect(result.warnings.length).toBeGreaterThan(3);
  });
});

describe('estimateHookConfidence', () => {
  it('returns native for same platform', () => {
    expect(estimateHookConfidence('cursor', 'cursor')).toBe('native');
  });

  it('returns native for claude to cursor', () => {
    expect(estimateHookConfidence('claude', 'cursor')).toBe('native');
  });

  it('returns low for windsurf target', () => {
    expect(estimateHookConfidence('cursor', 'windsurf')).toBe('low');
  });
});

describe('estimateCategoryConfidence', () => {
  it('returns native for universal source', () => {
    expect(estimateCategoryConfidence('skill', 'universal', 'cursor')).toBe('native');
  });

  it('returns high for skill cross-platform', () => {
    expect(estimateCategoryConfidence('skill', 'cursor', 'vscode')).toBe('high');
  });

  it('returns high for cursor to vscode rules', () => {
    expect(estimateCategoryConfidence('rule', 'cursor', 'vscode')).toBe('high');
  });

  it('returns high for cursor command to claude', () => {
    expect(estimateCategoryConfidence('command', 'cursor', 'claude')).toBe('high');
  });

  it('returns medium for rule to claude', () => {
    expect(estimateCategoryConfidence('rule', 'cursor', 'claude')).toBe('medium');
  });

  it('returns medium for mcp-tool cross-platform', () => {
    expect(estimateCategoryConfidence('mcp-tool', 'cursor', 'windsurf')).toBe('high');
  });
});

describe('transform router', () => {
  it('returns native when source platform is universal', () => {
    expect(transform('# Skill', 'skill', 'universal', 'cursor').confidence).toBe('native');
  });

  it('adds skill prompt metadata for medium-confidence transforms with destPath', () => {
    const content = '---\nglobs: ["*.ts"]\n---\n# Rule';
    const result = transform(content, 'rule', 'cursor', 'claude', { destPath: '.cursor/rules/x.mdc' });
    expect(result.skillPrompt).toContain('aitools-convert');
  });

  it('applies destination extension via applyDestExtension', () => {
    const result = transformCommand('# Cmd', 'claude', 'vscode');
    expect(applyDestExtension('prompt.md', result)).toBe('prompt.prompt.md');
  });

  it('returns early when hook transform recommends a native install path', () => {
    const claudeHooks = JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: 'x' }] } });
    const result = transform(claudeHooks, 'hook', 'claude', 'cursor');
    expect(result.recommendNativePath).toContain('.claude/settings.json');
  });
});

describe('mergeHookConfigs', () => {
  it('merges hook events into an empty claude settings file', () => {
    const incoming = JSON.stringify({
      hooks: { PreToolUse: [{ type: 'command', command: 'echo hi' }] },
    });
    const merged = mergeHookConfigs(null, incoming, 'claude');
    const parsed = JSON.parse(merged) as { hooks: Record<string, unknown[]> };
    expect(parsed.hooks.PreToolUse).toHaveLength(1);
  });

  it('appends handlers without removing existing hook events', () => {
    const existing = JSON.stringify({
      sessionStart: [{ type: 'command', command: 'echo start' }],
    });
    const incoming = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo tool' }],
    });
    const merged = mergeHookConfigs(existing, incoming, 'cursor');
    const parsed = JSON.parse(merged) as Record<string, unknown[]>;
    expect(parsed.sessionStart).toHaveLength(1);
    expect(parsed.preToolUse).toHaveLength(1);
  });

  it('ignores malformed existing config when merging', () => {
    const merged = mergeHookConfigs('{ bad json', JSON.stringify({ preToolUse: [] }), 'cursor');
    expect(JSON.parse(merged)).toEqual({ preToolUse: [] });
  });

  it('preserves other settings keys when merging claude hooks', () => {
    const existing = JSON.stringify({ model: 'sonnet', hooks: { SessionStart: [] } });
    const incoming = JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: 'x' }] } });
    const merged = mergeHookConfigs(existing, incoming, 'claude');
    const parsed = JSON.parse(merged) as { model: string; hooks: Record<string, unknown[]> };
    expect(parsed.model).toBe('sonnet');
    expect(parsed.hooks.PreToolUse).toHaveLength(1);
  });

  it('ignores non-array hook event values when merging', () => {
    const incoming = JSON.stringify({ preToolUse: 'not-an-array', sessionStart: [{ type: 'command', command: 'x' }] });
    const merged = mergeHookConfigs(null, incoming, 'cursor');
    const parsed = JSON.parse(merged) as Record<string, unknown[]>;
    expect(parsed.preToolUse).toBeUndefined();
    expect(parsed.sessionStart).toHaveLength(1);
  });

  it('skips invalid incoming hook JSON without throwing', () => {
    const existing = JSON.stringify({
      sessionStart: [{ type: 'command', command: 'echo start' }],
    });
    const merged = mergeHookConfigs(existing, '{ not json', 'cursor');
    expect(JSON.parse(merged)).toEqual({
      sessionStart: [{ type: 'command', command: 'echo start' }],
    });
  });
});

describe('extractHooksAdded', () => {
  it('returns empty object for invalid hook JSON', () => {
    expect(extractHooksAdded('{ not json', 'cursor')).toEqual({});
  });

  it('extracts non-empty event handlers', () => {
    const incoming = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'x' }],
      sessionStart: [],
    });
    expect(extractHooksAdded(incoming, 'cursor')).toEqual({
      preToolUse: [{ type: 'command', command: 'x' }],
    });
  });
});

describe('unmergeHookConfigs', () => {
  it('removes only previously added handlers', () => {
    const existing = JSON.stringify({
      afterFileEdit: [{ command: 'plugin' }, { command: 'user' }],
      sessionStart: [{ command: 'keep' }],
    });
    const cleaned = unmergeHookConfigs(
      existing,
      { afterFileEdit: [{ command: 'plugin' }] },
      'cursor',
    );
    const parsed = JSON.parse(cleaned) as Record<string, Array<{ command: string }>>;
    expect(parsed.afterFileEdit).toEqual([{ command: 'user' }]);
    expect(parsed.sessionStart).toEqual([{ command: 'keep' }]);
  });
});

describe('transform()', () => {
  it('returns native when from equals to', () => {
    const result = transform('content', 'rule', 'cursor', 'cursor');
    expect(result.confidence).toBe('native');
  });

  it('returns native when from is universal', () => {
    expect(transform('content', 'rule', 'universal', 'cursor').confidence).toBe('native');
  });

  it('passes through skills unchanged', () => {
    expect(transform('# Skill', 'skill', 'cursor', 'vscode').confidence).toBe('high');
  });

  it('returns recommendNativePath without adding skillPrompt', () => {
    const input = JSON.stringify({ PreToolUse: [{ type: 'command', command: 'x' }] });
    const result = transform(input, 'hook', 'claude', 'cursor', { destPath: '.claude/settings.json' });
    expect(result.recommendNativePath).toBeDefined();
    expect(result.skillPrompt).toBeUndefined();
  });

  it('adds skillPrompt for low confidence transforms', () => {
    const input = JSON.stringify({
      beforeShellExecution: [{ type: 'command', command: 'x' }],
    });
    const result = transform(input, 'hook', 'cursor', 'claude', { destPath: '.claude/settings.json' });
    expect(result.skillPrompt).toContain('/aitools-convert');
  });

  it('normalizes subagent category to agent transformer', () => {
    const input = `---\nname: a\n---\nBody`;
    const result = transform(input, 'subagent', 'cursor', 'windsurf');
    expect(result.confidence).toBe('unsupported');
  });
});

describe('applyDestExtension', () => {
  it('applies destExtension from transform result', () => {
    const result = { content: 'x', confidence: 'medium' as const, warnings: [], destExtension: '.prompt.md' };
    expect(applyDestExtension('cmd.md', result)).toBe('cmd.prompt.md');
  });

  it('returns filename unchanged when no destExtension', () => {
    const result = { content: 'x', confidence: 'high' as const, warnings: [] };
    expect(applyDestExtension('cmd.md', result)).toBe('cmd.md');
  });
});

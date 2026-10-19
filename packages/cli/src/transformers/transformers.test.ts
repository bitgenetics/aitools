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
import { transformRule } from './rule.js';
import { transformCommand } from './command.js';
import { transformAgent } from './agent.js';
import { transformHook, mergeHookConfigs, unmergeHookConfigs, extractHooksAdded } from './hook.js';
import { estimateCategoryConfidence, estimateHookConfidence } from './estimate.js';
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

  it('maps cursor alwaysApply to the vscode all-files glob', () => {
    const input = `---\nalwaysApply: true\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'vscode');
    expect(result.confidence).toBe('high');
    expect(result.content).toMatch(/^applyTo: "?\*\*"?$/m);
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

  it('maps cursor globs to claude paths', () => {
    const input = `---\nglobs: src/**\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'claude');
    expect(result.confidence).toBe('high');
    expect(result.content).toMatch(/^paths:\n {2}- src\/\*\*$/m);
    expect(result.content).toContain('# Rule body');
  });

  it('warns when a manually scoped cursor rule targets claude', () => {
    const input = `---\ndescription: Only when asked\n---\n# Rule body`;
    const result = transformRule(input, 'cursor', 'claude');
    expect(result.confidence).toBe('medium');
    expect(result.content).toContain('# aitools:');
  });

  it('maps vscode applyTo to cursor globs', () => {
    const input = `---\napplyTo: src/**\nexcludeAgent: foo\n---\n# Rule body`;
    const result = transformRule(input, 'vscode', 'cursor');
    expect(result.content).toContain('globs: src/**');
    expect(result.content).not.toMatch(/^excludeAgent:/m);
    expect(result.destExtension).toBe('.mdc');
  });

  it('maps vscode applyTo to claude paths', () => {
    const input = `---\napplyTo: src/**\n---\n# Rule body`;
    const result = transformRule(input, 'vscode', 'claude');
    expect(result.content).toContain('paths:');
    expect(result.content).toContain('# Rule body');
  });

  it('copies a plain rule without frontmatter unchanged between windsurf and vscode', () => {
    const input = 'plain rule without frontmatter';
    const result = transformRule(input, 'windsurf', 'vscode');
    expect(result.confidence).toBe('high');
    expect(result.content).toBe(input);
  });
});

describe('transformCommand', () => {
  it('returns native when from equals to', () => {
    expect(transformCommand('x', 'cursor', 'cursor').confidence).toBe('native');
  });

  it('leaves argument placeholders untouched between cursor and claude', () => {
    const result = transformCommand('Run lint on $1', 'cursor', 'claude');
    expect(result.content).toBe('Run lint on $1');
    expect(result.confidence).toBe('high');
  });

  it('adds prompt extension for cursor to vscode without annotation', () => {
    const result = transformCommand('# Cmd', 'cursor', 'vscode');
    expect(result.destExtension).toBe('.prompt.md');
    expect(result.confidence).toBe('high');
    expect(result.content).toBe('# Cmd');
  });

  it('adds description frontmatter for cursor to windsurf when missing', () => {
    const result = transformCommand('# Cmd', 'cursor', 'windsurf');
    expect(result.content).toContain('description: Workflow');
    expect(result.confidence).toBe('medium');
    expect(result.content).toContain('# aitools:');
  });

  it('adds prompt extension for claude to vscode', () => {
    const result = transformCommand('# Cmd', 'claude', 'vscode');
    expect(result.destExtension).toBe('.prompt.md');
  });

  it('drops claude-only command fields when targeting cursor', () => {
    const result = transformCommand('---\ndescription: Lint\nallowed-tools: Bash\n---\nRun.', 'claude', 'cursor');
    expect(result.content).not.toMatch(/^allowed-tools:/m);
    expect(result.confidence).toBe('medium');
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
    expect(result.warnings.some((w) => w.includes('readonly'))).toBe(true);
    expect(result.content).toContain('# aitools:');
  });

  it('drops claude-only fields when targeting cursor', () => {
    const input = `---\nname: my-agent\ntools: Read\nmaxTurns: 3\n---\nBody`;
    const result = transformAgent(input, 'claude', 'cursor');
    expect(result.content).not.toMatch(/^maxTurns:/m);
    expect(result.content).not.toMatch(/^tools:/m);
  });

  it('maps claude background to cursor is_background', () => {
    const input = `---\nname: my-agent\ndescription: d\nbackground: true\n---\nBody`;
    const result = transformAgent(input, 'claude', 'cursor');
    expect(result.content).toMatch(/^is_background: true$/m);
    expect(result.confidence).toBe('high');
  });

  it('adds agent extension for vscode target', () => {
    const input = `---\nname: my-agent\n---\nBody`;
    const result = transformAgent(input, 'cursor', 'vscode');
    expect(result.destExtension).toBe('.agent.md');
  });

  it('drops claude-only fields when targeting vscode', () => {
    const input = `---\nname: my-agent\nskills: []\n---\nBody`;
    const result = transformAgent(input, 'claude', 'vscode');
    expect(result.content).not.toMatch(/^skills:/m);
  });
});

describe('transformHook', () => {
  it('converts claude settings hooks into a cursor hooks file', () => {
    const input = JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: 'echo hi' }] } });
    const result = transformHook(input, 'claude', 'cursor');
    expect(result.confidence).toBe('high');
    expect(JSON.parse(result.content)).toEqual({
      version: 1,
      hooks: { preToolUse: [{ type: 'command', command: 'echo hi' }] },
    });
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

  it('keeps portable events in PascalCase when transforming cursor to vscode', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo hi' }],
      beforeShellExecution: [{ type: 'command', command: 'echo drop' }],
    });
    const result = transformHook(input, 'cursor', 'vscode');
    expect(JSON.parse(result.content)).toEqual({
      hooks: { PreToolUse: [{ type: 'command', command: 'echo hi' }] },
    });
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
    expect(result.confidence).toBe('low');
  });

  it('returns unsupported when no portable events remain', () => {
    const input = JSON.stringify({
      beforeShellExecution: [{ type: 'command', command: 'x' }],
    });
    const result = transformHook(input, 'cursor', 'claude');
    expect(result.confidence).toBe('unsupported');
    expect(result.content).toBe('');
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

  it('groups command hooks the claude way when transforming cursor to claude', () => {
    const input = JSON.stringify({
      preToolUse: [{ type: 'command', command: 'echo hi', matcher: 'Write' }],
    });
    const result = transformHook(input, 'cursor', 'claude');
    expect(JSON.parse(result.content)).toEqual({
      hooks: { PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo hi' }] }] },
    });
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

  it('returns high for claude to cursor', () => {
    expect(estimateHookConfidence('claude', 'cursor')).toBe('high');
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

  it('returns high for a glob-scoped cursor rule to claude', () => {
    expect(estimateCategoryConfidence('rule', 'cursor', 'claude')).toBe('high');
  });

  it('returns unsupported for agents on windsurf', () => {
    expect(estimateCategoryConfidence('subagent', 'cursor', 'windsurf')).toBe('unsupported');
  });

  it('returns high for mcp-tool cross-platform', () => {
    expect(estimateCategoryConfidence('mcp-tool', 'cursor', 'windsurf')).toBe('high');
  });

  it('returns native for instruction files on every platform', () => {
    expect(estimateCategoryConfidence('instructions', 'claude', 'cursor')).toBe('native');
  });
});

describe('transform router', () => {
  it('returns native when source platform is universal', () => {
    expect(transform('# Skill', 'skill', 'universal', 'cursor').confidence).toBe('native');
  });

  it('adds skill prompt metadata for medium-confidence transforms with destPath', () => {
    const content = '---\napplyTo: "*.ts"\nexcludeAgent: foo\n---\n# Rule';
    const result = transform(content, 'rule', 'vscode', 'cursor', { destPath: '.cursor/rules/x.mdc' });
    expect(result.skillPrompt).toContain('aitools-convert');
  });

  it('applies destination extension via applyDestExtension', () => {
    const result = transformCommand('# Cmd', 'claude', 'vscode');
    expect(applyDestExtension('prompt.md', result)).toBe('prompt.prompt.md');
  });

  it('copies instruction files unchanged between vendors', () => {
    const result = transform('# AGENTS', 'instructions', 'claude', 'cursor');
    expect(result.confidence).toBe('native');
    expect(result.content).toBe('# AGENTS');
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
      version: 1,
      hooks: { sessionStart: [{ type: 'command', command: 'echo start' }] },
    });
    const incoming = JSON.stringify({
      hooks: { preToolUse: [{ type: 'command', command: 'echo tool' }] },
    });
    const merged = mergeHookConfigs(existing, incoming, 'cursor');
    const parsed = JSON.parse(merged) as { hooks: Record<string, unknown[]> };
    expect(parsed.hooks.sessionStart).toHaveLength(1);
    expect(parsed.hooks.preToolUse).toHaveLength(1);
  });

  it('migrates a flat legacy cursor hooks file to the versioned shape', () => {
    const existing = JSON.stringify({ sessionStart: [{ command: 'echo start' }] });
    const merged = mergeHookConfigs(existing, JSON.stringify({ preToolUse: [{ command: 'x' }] }), 'cursor');
    expect(JSON.parse(merged)).toEqual({
      version: 1,
      hooks: { sessionStart: [{ command: 'echo start' }], preToolUse: [{ command: 'x' }] },
    });
  });

  it('ignores malformed existing config when merging', () => {
    const merged = mergeHookConfigs('{ bad json', JSON.stringify({ preToolUse: [] }), 'cursor');
    expect(JSON.parse(merged)).toEqual({ version: 1, hooks: { preToolUse: [] } });
  });

  it('preserves other settings keys when merging claude hooks', () => {
    const existing = JSON.stringify({ model: 'sonnet', hooks: { SessionStart: [] } });
    const incoming = JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: 'x' }] } });
    const merged = mergeHookConfigs(existing, incoming, 'claude');
    const parsed = JSON.parse(merged) as { model: string; hooks: Record<string, unknown[]> };
    expect(parsed.model).toBe('sonnet');
    expect(parsed.hooks.PreToolUse).toHaveLength(1);
  });

  it('writes vscode hooks under the hooks key', () => {
    const merged = mergeHookConfigs(null, JSON.stringify({ hooks: { PreToolUse: [{ command: 'x' }] } }), 'vscode');
    expect(JSON.parse(merged)).toEqual({ hooks: { PreToolUse: [{ command: 'x' }] } });
  });

  it('ignores non-array hook event values when merging', () => {
    const incoming = JSON.stringify({ preToolUse: 'not-an-array', sessionStart: [{ type: 'command', command: 'x' }] });
    const merged = mergeHookConfigs(null, incoming, 'cursor');
    const parsed = JSON.parse(merged) as { hooks: Record<string, unknown[]> };
    expect(parsed.hooks.preToolUse).toBeUndefined();
    expect(parsed.hooks.sessionStart).toHaveLength(1);
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
      version: 1,
      hooks: {
        afterFileEdit: [{ command: 'plugin' }, { command: 'user' }],
        sessionStart: [{ command: 'keep' }],
      },
    });
    const cleaned = unmergeHookConfigs(
      existing,
      { afterFileEdit: [{ command: 'plugin' }] },
      'cursor',
    );
    const parsed = JSON.parse(cleaned) as { hooks: Record<string, Array<{ command: string }>> };
    expect(parsed.hooks.afterFileEdit).toEqual([{ command: 'user' }]);
    expect(parsed.hooks.sessionStart).toEqual([{ command: 'keep' }]);
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

  it('converts claude hooks for cursor with high confidence and no skillPrompt', () => {
    const input = JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: 'x' }] } });
    const result = transform(input, 'hook', 'claude', 'cursor', { destPath: '.cursor/hooks.json' });
    expect(result.confidence).toBe('high');
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

  it('replaces a compound vendor suffix as a whole', () => {
    const result = { content: 'x', confidence: 'high' as const, warnings: [], destExtension: '.mdc' };
    expect(applyDestExtension('style.instructions.md', result)).toBe('style.mdc');
  });

  it('returns filename unchanged when no destExtension', () => {
    const result = { content: 'x', confidence: 'high' as const, warnings: [] };
    expect(applyDestExtension('cmd.md', result)).toBe('cmd.md');
  });
});

// -- Vendor format fidelity (review 2026-10-18) ------------------------------

describe('transformRule (vendor format fidelity)', () => {
  it('keeps Cursor globs written as a YAML list when targeting vscode', () => {
    const content = '---\ndescription: Style\nglobs:\n  - "*.ts"\n  - "*.tsx"\n---\nBe tidy.\n';
    const result = transformRule(content, 'cursor', 'vscode');
    expect(result.content).toContain('applyTo:');
  });

  it('keeps description when mapping a cursor rule to vscode', () => {
    const content = '---\ndescription: Style guide\nglobs: "*.ts"\n---\nBe tidy.\n';
    const result = transformRule(content, 'cursor', 'vscode');
    expect(result.content).toContain('description: Style guide');
  });

  it('adds the .mdc extension when a Claude rule targets cursor', () => {
    const result = transformRule('Be tidy.\n', 'claude', 'cursor');
    expect(result.destExtension).toBe('.mdc');
  });

  it('maps windsurf always_on to cursor alwaysApply', () => {
    const content = '---\ntrigger: always_on\n---\nBe tidy.\n';
    const result = transformRule(content, 'windsurf', 'cursor');
    expect(result.content).toMatch(/^alwaysApply: true$/m);
    expect(result.confidence).toBe('high');
  });
});

describe('transformAgent (vendor format fidelity)', () => {
  it('keeps the tools field when a Claude agent targets vscode', () => {
    const content = '---\nname: reviewer\ndescription: Reviews code\ntools: Read, Grep\n---\nReview.\n';
    const result = transformAgent(content, 'claude', 'vscode');
    expect(result.content).toMatch(/^tools:/m);
  });
});

describe('transformCommand (vendor format fidelity)', () => {
  it('adds the .prompt.md extension for a Claude command whose body names a .prompt.md file', () => {
    const content = 'Run the checklist in review.prompt.md';
    const result = transformCommand(content, 'claude', 'vscode');
    expect(result.destExtension).toBe('.prompt.md');
  });
});

describe('estimateCategoryConfidence (single authority)', () => {
  const VENDORS = ['vscode', 'claude', 'cursor', 'windsurf'] as const;
  type Vendor = (typeof VENDORS)[number];
  type Category = 'rule' | 'command' | 'agent';
  // Common fields only, each written the way the source vendor spells them.
  const FIXTURES: Record<Category, Record<Vendor, string>> = {
    rule: {
      cursor: '---\ndescription: Tidy\nglobs: "src/**"\n---\nBe tidy.\n',
      vscode: '---\ndescription: Tidy\napplyTo: "src/**"\n---\nBe tidy.\n',
      claude: '---\ndescription: Tidy\npaths:\n  - "src/**"\n---\nBe tidy.\n',
      windsurf: '---\ndescription: Tidy\ntrigger: glob\nglobs: "src/**"\n---\nBe tidy.\n',
    },
    command: {
      cursor: '---\ndescription: Lint it\n---\nRun lint.\n',
      vscode: '---\ndescription: Lint it\n---\nRun lint.\n',
      claude: '---\ndescription: Lint it\n---\nRun lint.\n',
      windsurf: '---\ndescription: Lint it\n---\nRun lint.\n',
    },
    agent: {
      cursor: '---\nname: tester\ndescription: Tests\n---\nTest it.\n',
      vscode: '---\nname: tester\ndescription: Tests\n---\nTest it.\n',
      claude: '---\nname: tester\ndescription: Tests\n---\nTest it.\n',
      windsurf: '---\nname: tester\ndescription: Tests\n---\nTest it.\n',
    },
  };

  it('agrees with the transformer for every vendor pair on a portable fixture', () => {
    const mismatches: string[] = [];
    for (const category of Object.keys(FIXTURES) as Category[]) {
      for (const from of VENDORS) {
        for (const to of VENDORS) {
          if (from === to) continue;
          const estimate = estimateCategoryConfidence(category, from, to);
          const actual = transform(FIXTURES[category][from], category, from, to).confidence;
          if (estimate !== actual) {
            mismatches.push(`${category} ${from}->${to}: estimate=${estimate} actual=${actual}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

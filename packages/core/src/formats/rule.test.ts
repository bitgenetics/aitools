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
import { convertRule, RULE_EXTENSION } from './rule.js';
import { parseFrontmatter } from './frontmatter.js';

function fields(content: string): Record<string, unknown> {
  return parseFrontmatter(content).fields;
}

describe('convertRule', () => {
  it('joins a cursor glob list into the vscode applyTo string', () => {
    const result = convertRule('---\nglobs:\n  - "*.ts"\n  - "*.tsx"\n---\nBody', 'cursor', 'vscode');
    expect(fields(result.content)).toEqual({ applyTo: '*.ts,*.tsx' });
  });

  it('maps cursor alwaysApply to the vscode all-files glob', () => {
    const result = convertRule('---\nalwaysApply: true\n---\nBody', 'cursor', 'vscode');
    expect(fields(result.content)['applyTo']).toBe('**');
  });

  it('maps cursor globs to a claude paths list', () => {
    const result = convertRule('---\nglobs: "src/**,test/**"\n---\nBody', 'cursor', 'claude');
    expect(fields(result.content)).toEqual({ paths: ['src/**', 'test/**'] });
  });

  it('warns when a manually scoped rule targets claude', () => {
    const result = convertRule('---\ndescription: On request\n---\nBody', 'cursor', 'claude');
    expect(result.warnings).toHaveLength(1);
  });

  it('treats a claude rule without paths as always-on for cursor', () => {
    const result = convertRule('Body only', 'claude', 'cursor');
    expect(fields(result.content)).toEqual({ alwaysApply: true });
  });

  it('maps the vscode all-files glob to windsurf always_on', () => {
    const result = convertRule('---\napplyTo: "**"\n---\nBody', 'vscode', 'windsurf');
    expect(fields(result.content)['trigger']).toBe('always_on');
  });

  it('maps a windsurf model_decision rule to a description-only cursor rule', () => {
    const result = convertRule('---\ntrigger: model_decision\ndescription: Use for tests\n---\nBody', 'windsurf', 'cursor');
    expect(fields(result.content)).toEqual({ description: 'Use for tests' });
  });

  it('drops fields the source vendor does not define and says so', () => {
    const result = convertRule('---\nglobs: "*.ts"\nmystery: 1\n---\nBody', 'cursor', 'vscode');
    expect(result.warnings).toEqual([expect.stringContaining('"mystery"')]);
  });

  it('keeps the body verbatim', () => {
    const result = convertRule('---\nglobs: "*.ts"\n---\n# Title\n\nText\n', 'cursor', 'windsurf');
    expect(result.content.endsWith('---\n# Title\n\nText\n')).toBe(true);
  });

  it('copies content unchanged when the frontmatter is not valid YAML', () => {
    const broken = '---\nglobs: [unclosed\n---\nBody';
    const result = convertRule(broken, 'cursor', 'vscode');
    expect(result.content).toBe(broken);
  });

  it('reports the target vendor extension', () => {
    expect(convertRule('Body', 'claude', 'vscode').extension).toBe(RULE_EXTENSION.vscode);
  });
});

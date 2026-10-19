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
import { convertAgent } from './agent.js';
import { parseFrontmatter } from './frontmatter.js';

const CLAUDE_AGENT = '---\nname: reviewer\ndescription: Reviews\ntools: Read, Grep\nmaxTurns: 3\n---\nReview.\n';

function fields(content: string): Record<string, unknown> {
  return parseFrontmatter(content).fields;
}

describe('convertAgent', () => {
  it('is unsupported on windsurf', () => {
    const result = convertAgent(CLAUDE_AGENT, 'claude', 'windsurf');
    expect(result.unsupported).toBe(true);
  });

  it('keeps tools as a list for vscode with a review warning', () => {
    const result = convertAgent(CLAUDE_AGENT, 'claude', 'vscode');
    expect(fields(result.content)['tools']).toEqual(['Read', 'Grep']);
  });

  it('names the tools field in the vscode review warning', () => {
    const result = convertAgent(CLAUDE_AGENT, 'claude', 'vscode');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('"tools"')]));
  });

  it('drops tools for cursor', () => {
    const result = convertAgent(CLAUDE_AGENT, 'claude', 'cursor');
    expect(fields(result.content)).toEqual({ name: 'reviewer', description: 'Reviews' });
  });

  it('maps cursor is_background to claude background', () => {
    const result = convertAgent('---\nname: a\nis_background: true\n---\nBody', 'cursor', 'claude');
    expect(fields(result.content)['background']).toBe(true);
  });

  it('drops cursor readonly with a warning', () => {
    const result = convertAgent('---\nname: a\nreadonly: true\n---\nBody', 'cursor', 'claude');
    expect(result.warnings).toEqual([expect.stringContaining('"readonly"')]);
  });

  it('warns when the agent has no frontmatter', () => {
    const result = convertAgent('Body only', 'cursor', 'claude');
    expect(result.warnings).toEqual([expect.stringContaining('No frontmatter')]);
  });

  it('is lossless for common fields between cursor and vscode', () => {
    const result = convertAgent('---\nname: a\ndescription: b\nmodel: inherit\n---\nBody', 'cursor', 'vscode');
    expect(result.warnings).toEqual([]);
  });
});

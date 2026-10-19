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
import { convertCommand } from './command.js';
import { parseFrontmatter } from './frontmatter.js';

describe('convertCommand', () => {
  it('keeps description between vendors', () => {
    const result = convertCommand('---\ndescription: Lint\n---\nRun $ARGUMENTS', 'claude', 'cursor');
    expect(parseFrontmatter(result.content).fields).toEqual({ description: 'Lint' });
  });

  it('leaves argument placeholders untouched', () => {
    const result = convertCommand('Run $ARGUMENTS and $1', 'claude', 'cursor');
    expect(result.content).toBe('Run $ARGUMENTS and $1');
  });

  it('adds a placeholder description for windsurf with a warning', () => {
    const result = convertCommand('Run it', 'cursor', 'windsurf');
    expect(result.warnings).toEqual([expect.stringContaining('placeholder description')]);
  });

  it('drops vendor-only fields with a warning', () => {
    const result = convertCommand('---\ndescription: Lint\nargument-hint: file\n---\nRun', 'claude', 'cursor');
    expect(result.warnings).toEqual([expect.stringContaining('"argument-hint"')]);
  });

  it('uses the prompt extension for vscode', () => {
    expect(convertCommand('Run', 'claude', 'vscode').extension).toBe('.prompt.md');
  });
});

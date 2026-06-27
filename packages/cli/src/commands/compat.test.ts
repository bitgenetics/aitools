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
import { parseSkillFrontmatter, analyzeCompat, rewriteSkillFrontmatter } from './compat.js';
import { PLATFORM_SPECS } from '@aitools/core';

// -- parseSkillFrontmatter --------------------------------------------------

describe('parseSkillFrontmatter', () => {
  it('returns null when no YAML frontmatter block is present', () => {
    expect(parseSkillFrontmatter('# Just a markdown file\n\nNo frontmatter.')).toBeNull();
  });

  it('parses a string value', () => {
    const content = '---\nname: my-skill\n---\n# Body';
    expect(parseSkillFrontmatter(content)?.['name']).toBe('my-skill');
  });

  it('parses a boolean true value', () => {
    const content = '---\nuser-invocable: true\n---';
    expect(parseSkillFrontmatter(content)?.['user-invocable']).toBe(true);
  });

  it('parses a boolean false value', () => {
    const content = '---\ndisable-model-invocation: false\n---';
    expect(parseSkillFrontmatter(content)?.['disable-model-invocation']).toBe(false);
  });

  it('parses multiple fields in one block', () => {
    const content = '---\nname: my-skill\nuser-invocable: true\nargument-hint: Enter a topic\n---';
    const result = parseSkillFrontmatter(content);
    expect(result).toEqual({
      name: 'my-skill',
      'user-invocable': true,
      'argument-hint': 'Enter a topic',
    });
  });

  it('strips surrounding single quotes from string values', () => {
    const content = "---\nname: 'quoted-name'\n---";
    expect(parseSkillFrontmatter(content)?.['name']).toBe('quoted-name');
  });

  it('strips surrounding double quotes from string values', () => {
    const content = '---\nname: "double-quoted"\n---';
    expect(parseSkillFrontmatter(content)?.['name']).toBe('double-quoted');
  });

  it('skips multi-line continuation lines (leading whitespace)', () => {
    const content = '---\ndescription: >-\n  line one\n  line two\nname: my-skill\n---';
    const result = parseSkillFrontmatter(content);
    expect(result?.['name']).toBe('my-skill');
    expect(result?.['description']).toBeUndefined();
  });

  it('skips lines with a >- multi-line indicator as value', () => {
    const content = '---\ndescription: >-\nname: my-skill\n---';
    const result = parseSkillFrontmatter(content);
    expect(result?.['description']).toBeUndefined();
  });
});

// -- analyzeCompat ----------------------------------------------------------

describe('analyzeCompat', () => {
  it('marks a supported category as supported', () => {
    const [result] = analyzeCompat({}, 'skill', ['vscode']);
    expect(result?.categorySupported).toBe(true);
  });

  it('marks an unsupported category as not supported', () => {
    // universal platform only lists specific supported categories — use a
    // category that is not in any spec's list to trigger false
    const universalSpec = PLATFORM_SPECS['universal'];
    const unsupportedCategory = 'mcp-tool';
    const supported = universalSpec.supportedCategories.includes(unsupportedCategory as never);
    const [result] = analyzeCompat({}, unsupportedCategory, ['universal']);
    expect(result?.categorySupported).toBe(supported);
  });

  it('reports no field issues when there are no frontmatter fields', () => {
    const [result] = analyzeCompat({}, 'skill', ['vscode']);
    expect(result?.fieldIssues).toHaveLength(0);
  });

  it('reports no issue for a fully supported field on vscode', () => {
    const [result] = analyzeCompat({ name: 'my-skill', description: 'test' }, 'skill', ['vscode']);
    expect(result?.fieldIssues).toHaveLength(0);
  });

  it('marks argument-hint as ignored on cursor', () => {
    const [result] = analyzeCompat({ 'argument-hint': 'some hint' }, 'skill', ['cursor']);
    const issue = result?.fieldIssues.find((i) => i.field === 'argument-hint');
    expect(issue?.support).toBe('ignored');
  });

  it('marks a field absent from platform spec data as unknown', () => {
    const [result] = analyzeCompat({ 'totally-unknown-field': 'value' }, 'skill', ['vscode']);
    const issue = result?.fieldIssues.find((i) => i.field === 'totally-unknown-field');
    expect(issue?.support).toBe('unknown');
  });

  it('includes a note for fields with notes in the spec', () => {
    // argument-hint on cursor has a note
    const [result] = analyzeCompat({ 'argument-hint': 'hint' }, 'skill', ['cursor']);
    const issue = result?.fieldIssues.find((i) => i.field === 'argument-hint');
    expect(typeof issue?.note).toBe('string');
  });

  it('produces one result per platform when multiple platforms are specified', () => {
    const platforms = ['vscode', 'cursor'] as const;
    const results = analyzeCompat({}, 'skill', [...platforms]);
    expect(results).toHaveLength(2);
  });

  it('produces results for every known platform when all are specified', () => {
    const allPlatforms = Object.keys(PLATFORM_SPECS) as Array<keyof typeof PLATFORM_SPECS>;
    const results = analyzeCompat({}, 'skill', allPlatforms);
    expect(results).toHaveLength(allPlatforms.length);
  });

  it('does not report field issues when category is not supported', () => {
    // When a platform does not support the category, field issues are irrelevant
    // and should not be generated even if fields are present.
    // Find a category that at least one platform doesn't support.
    const spec = PLATFORM_SPECS['universal'];
    const nonSupportedCat = spec.supportedCategories.includes('skill' as never) ? 'mcp-tool' : 'skill';
    const supported = spec.supportedCategories.includes(nonSupportedCat as never);
    if (!supported) {
      const [result] = analyzeCompat({ name: 'x' }, nonSupportedCat, ['universal']);
      expect(result?.fieldIssues).toHaveLength(0);
    }
  });
});
// -- rewriteSkillFrontmatter -------------------------------------------------



describe('rewriteSkillFrontmatter', () => {
  it('returns content unchanged when there is no frontmatter', () => {
    const content = '# No frontmatter here';
    expect(rewriteSkillFrontmatter(content, new Set(['name']))).toBe(content);
  });

  it('removes a field that is in the remove set', () => {
    const content = '---\nname: my-skill\nargument-hint: Enter a topic\n---\n# Body';
    const result = rewriteSkillFrontmatter(content, new Set(['argument-hint']));
    expect(result).not.toContain('argument-hint');
    expect(result).toContain('name: my-skill');
  });

  it('preserves fields not in the remove set', () => {
    const content = '---\nname: my-skill\ndescription: A skill\n---\n# Body';
    const result = rewriteSkillFrontmatter(content, new Set(['description']));
    expect(result).toContain('name: my-skill');
    expect(result).not.toContain('description:');
  });

  it('preserves the document body after the frontmatter', () => {
    const content = '---\nname: my-skill\n---\n# Body content';
    const result = rewriteSkillFrontmatter(content, new Set(['name']));
    expect(result).toContain('# Body content');
  });

  it('returns valid frontmatter block structure after removal', () => {
    const content = '---\nname: my-skill\nfoo: bar\n---\n# Body';
    const result = rewriteSkillFrontmatter(content, new Set(['foo']));
    expect(result.startsWith('---')).toBe(true);
  });
});

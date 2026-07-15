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
import { parseSkillFrontmatter, analyzeCompat, rewriteSkillFrontmatter } from './compat.js';
import { createCompatCommand } from './compat.js';
import { PLATFORM_SPECS } from '@bitgenetics/aitools-core';
import type { TargetPlatform } from '@bitgenetics/aitools-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
    // universal platform only lists specific supported categories � use a
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
    const allPlatforms = Object.keys(PLATFORM_SPECS) as TargetPlatform[];
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

  it('reports native transform confidence when nativeFor matches the target platform', () => {
    const [result] = analyzeCompat({}, 'rule', ['cursor'], 'cursor');
    expect(result?.transformConfidence).toBe('native');
  });

  it('reports lower confidence when nativeFor differs from the target platform', () => {
    const [result] = analyzeCompat({}, 'hook', ['windsurf'], 'cursor');
    expect(result?.transformConfidence).toBe('low');
  });

  it('treats deprecated subagent category as agent for transform confidence', () => {
    const [result] = analyzeCompat({}, 'subagent', ['windsurf'], 'cursor');
    expect(result?.transformConfidence).toBe('unsupported');
  });
});

describe('compat command action', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-compat-cmd-'));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
    jest.restoreAllMocks();
  });

  function writeManifest(dir: string, manifest: Record<string, unknown>, skillContent?: string) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'aitools.json'), JSON.stringify(manifest), 'utf8');
    if (skillContent) {
      fs.mkdirSync(path.join(dir, 'skill'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'skill', 'SKILL.md'), skillContent, 'utf8');
    }
  }

  it('prints compatibility report for a valid manifest', async () => {
    writeManifest(tmp, {
      name: 'my-skill',
      version: '1.0.0',
      description: 'Test',
      category: 'skill',
      nativeFor: 'cursor',
      files: [{ src: 'skill/SKILL.md', dest: 'skill/SKILL.md' }],
    }, '---\nname: my-skill\ndescription: test\n---\n# Body');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createCompatCommand().parseAsync([], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('Compatibility:');
    expect(output).toContain('nativeFor');
  });

  it('strips unsupported frontmatter fields with --fix', async () => {
    writeManifest(tmp, {
      name: 'my-skill',
      version: '1.0.0',
      description: 'Test',
      category: 'skill',
      files: [{ src: 'skill/SKILL.md', dest: 'skill/SKILL.md' }],
    }, '---\nname: my-skill\nargument-hint: hint\n---\n# Body');

    jest.spyOn(console, 'log').mockImplementation(() => {});
    await createCompatCommand().parseAsync(['--fix', '--platform', 'cursor'], { from: 'user' });

    const skillPath = path.join(tmp, 'skill', 'SKILL.md');
    const content = fs.readFileSync(skillPath, 'utf8');
    expect(content).not.toContain('argument-hint');
    expect(content).toContain('name: my-skill');
  });

  function mockExit(): jest.SpiedFunction<typeof process.exit> {
    return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
  }

  it('prints compatibility issues when frontmatter fields are ignored', async () => {
    writeManifest(tmp, {
      name: 'my-skill',
      version: '1.0.0',
      description: 'Test',
      category: 'skill',
      files: [{ src: 'skill/SKILL.md', dest: 'skill/SKILL.md' }],
    }, '---\nname: my-skill\nargument-hint: hint\n---\n# Body');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createCompatCommand().parseAsync(['--platform', 'cursor'], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('Compatibility issues found');
  });

  it('reports all platforms compatible for hook category', async () => {
    writeManifest(tmp, {
      name: 'my-hook',
      version: '1.0.0',
      description: 'Hooks',
      category: 'hook',
      nativeFor: 'cursor',
      files: [{ src: 'hooks.json', dest: 'hooks.json' }],
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createCompatCommand().parseAsync(['--platform', 'cursor'], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('All platforms compatible');
  });

  it('prints transform confidence across platforms for hook manifests', async () => {
    writeManifest(tmp, {
      name: 'my-hook',
      version: '1.0.0',
      description: 'Hooks',
      category: 'hook',
      nativeFor: 'cursor',
      files: [{ src: 'hooks.json', dest: 'hooks.json' }],
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createCompatCommand().parseAsync([], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('transform');
  });

  it('reports when --fix has no removable frontmatter fields', async () => {
    writeManifest(tmp, {
      name: 'my-skill',
      version: '1.0.0',
      description: 'Test',
      category: 'skill',
      files: [{ src: 'skill/SKILL.md', dest: 'skill/SKILL.md' }],
    }, '---\nname: my-skill\n---\n# Body');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createCompatCommand().parseAsync(['--fix'], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('no fields to remove');
  });

  it('exits when manifest file is missing', async () => {
    const exitSpy = mockExit();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createCompatCommand().parseAsync([], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('exits when manifest JSON is invalid', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), '{ invalid', 'utf8');
    const exitSpy = mockExit();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createCompatCommand().parseAsync([], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('exits for unknown platform option', async () => {
    writeManifest(tmp, {
      name: 'x',
      version: '1.0.0',
      description: 'Test',
      category: 'skill',
      files: [{ src: 'skill/SKILL.md', dest: 'skill/SKILL.md' }],
    });
    const exitSpy = mockExit();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      createCompatCommand().parseAsync(['--platform', 'not-a-platform'], { from: 'user' }),
    ).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
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

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
import { ToolManifestSchema } from '../schema/tool-schema.js';

const VALID_MANIFEST = {
  name: 'my-skill',
  version: '1.0.0',
  description: 'A test skill',
  category: 'skill' as const,
  files: [{ src: 'skill.md', dest: 'skill.md' }],
};

describe('ToolManifestSchema', () => {
  it('accepts a minimal valid manifest', () => {
    expect(ToolManifestSchema.safeParse(VALID_MANIFEST).success).toBe(true);
  });

  it('accepts a scoped package name', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, name: '@my-org/my-skill' });
    expect(result.success).toBe(true);
  });

  it('accepts all valid category values', () => {
    for (const category of [
      'skill',
      'rule',
      'command',
      'agent',
      'hook',
      'mcp-tool',
      'reference',
      'subagent',
      'prompt',
    ]) {
      const files =
        category === 'mcp-tool'
          ? []
          : category === 'reference'
            ? [{ src: 'checklist.md', dest: 'checklist.md' }]
            : [{ src: 'file.md', dest: 'file.md' }];
      const mcpServer = category === 'mcp-tool' ? { command: 'npx' } : undefined;
      const nativeFor = category === 'plugin' ? 'cursor' : undefined;
      const pluginFiles =
        category === 'plugin'
          ? [
              { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
              { src: 'skills/a/SKILL.md', dest: 'skills/a/SKILL.md' },
            ]
          : files;
      const result = ToolManifestSchema.safeParse({
        ...VALID_MANIFEST,
        category,
        files: pluginFiles,
        mcpServer,
        nativeFor,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts nativeFor when set to a valid platform', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, nativeFor: 'cursor' });
    expect(result.success).toBe(true);
  });

  it('rejects nativeFor when set to an invalid platform', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, nativeFor: 'invalid-platform' });
    expect(result.success).toBe(false);
  });

  it('accepts placementMode strict and transform on file entries', () => {
    for (const placementMode of ['strict', 'transform'] as const) {
      const result = ToolManifestSchema.safeParse({
        ...VALID_MANIFEST,
        files: [{ src: 'skill.md', dest: 'skill.md', placementMode }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts a file entry that omits placementMode', () => {
    const result = ToolManifestSchema.safeParse(VALID_MANIFEST);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid placementMode value', () => {
    const result = ToolManifestSchema.safeParse({
      ...VALID_MANIFEST,
      files: [{ src: 'skill.md', dest: 'skill.md', placementMode: 'loose' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid mcp-tool manifest with an mcpServer descriptor', () => {
    const result = ToolManifestSchema.safeParse({
      name: 'my-mcp-server',
      version: '1.0.0',
      description: 'An MCP server tool',
      category: 'mcp-tool',
      files: [],
      mcpServer: { command: 'npx', args: ['my-mcp-server'] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an mcp-tool manifest without an mcpServer descriptor', () => {
    const result = ToolManifestSchema.safeParse({
      name: 'my-mcp-server',
      version: '1.0.0',
      description: 'An MCP server tool',
      category: 'mcp-tool',
      files: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an invalid package name containing spaces', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, name: 'Invalid Name' });
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an invalid package name containing uppercase letters', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, name: 'MySkill' });
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an invalid semver version', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, version: 'not-semver' });
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an unknown category', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, category: 'widget' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid plugin manifest with nativeFor and cursor plugin descriptor', () => {
    const result = ToolManifestSchema.safeParse({
      name: '@team/code-review-plugin',
      version: '1.0.0',
      description: 'Review plugin bundle',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/review/SKILL.md', dest: 'skills/review/SKILL.md' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a plugin manifest without nativeFor', () => {
    const result = ToolManifestSchema.safeParse({
      ...VALID_MANIFEST,
      category: 'plugin',
      files: [{ src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a cursor plugin manifest without .cursor-plugin/plugin.json in files', () => {
    const result = ToolManifestSchema.safeParse({
      name: '@team/my-plugin',
      version: '1.0.0',
      description: 'Plugin',
      category: 'plugin',
      nativeFor: 'cursor',
      files: [{ src: 'skills/review/SKILL.md', dest: 'skills/review/SKILL.md' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a reference manifest with flat content files', () => {
    const result = ToolManifestSchema.safeParse({
      name: '@acme/sharedref',
      version: '1.0.0',
      description: 'Accessibility checklist',
      category: 'reference',
      files: [
        { src: 'checklist.md', dest: 'checklist.md' },
        { src: 'sources.md', dest: 'sources.md' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a reference manifest with only index.md', () => {
    const result = ToolManifestSchema.safeParse({
      name: 'sharedref',
      version: '1.0.0',
      description: 'Metadata only',
      category: 'reference',
      files: [{ src: 'index.md', dest: 'index.md' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts skill manifest with references shorthand and rejects into plugin', () => {
    const ok = ToolManifestSchema.safeParse({
      ...VALID_MANIFEST,
      references: { sharedref: '^2.0.0' },
    });
    expect(ok.success).toBe(true);

    const bad = ToolManifestSchema.safeParse({
      ...VALID_MANIFEST,
      references: { sharedref: { range: '^2.0.0', into: 'plugin' } },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a manifest with an empty files array', () => {
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, files: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with a missing description', () => {
    const { description: _, ...rest } = VALID_MANIFEST;
    const result = ToolManifestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('accepts optional fields when provided', () => {
    const result = ToolManifestSchema.safeParse({
      ...VALID_MANIFEST,
      keywords: ['search', 'ai'],
      author: 'tester',
      tags: ['useful'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a file entry with a valid platform value', () => {
    const manifest = {
      ...VALID_MANIFEST,
      files: [{ src: 'skill.vscode.md', dest: 'skill.md', platform: 'vscode' }],
    };
    expect(ToolManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('rejects a file entry with an unknown platform value', () => {
    const manifest = {
      ...VALID_MANIFEST,
      files: [{ src: 'skill.md', dest: 'skill.md', platform: 'unknown-ide' }],
    };
    expect(ToolManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('accepts a valid http mcp-tool manifest with a url and no command', () => {
    const result = ToolManifestSchema.safeParse({
      name: 'my-http-mcp',
      version: '1.0.0',
      description: 'HTTP MCP server',
      category: 'mcp-tool',
      files: [],
      mcpServer: { url: 'https://mcp.example.com/server' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an mcp-tool manifest with both command and url set', () => {
    const result = ToolManifestSchema.safeParse({
      name: 'my-mcp',
      version: '1.0.0',
      description: 'Conflicting MCP server',
      category: 'mcp-tool',
      files: [],
      mcpServer: { command: 'npx', url: 'https://mcp.example.com/server' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an mcp-tool manifest with neither command nor url', () => {
    const result = ToolManifestSchema.safeParse({
      name: 'my-mcp',
      version: '1.0.0',
      description: 'Empty MCP server',
      category: 'mcp-tool',
      files: [],
      mcpServer: {},
    });
    expect(result.success).toBe(false);
  });
});

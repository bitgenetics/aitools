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
import { isPublishable, toPublishManifest } from './publish-manifest.js';
import { AitoolsJsonSchema } from '../schema/config-schema.js';

const FULL_DOC = {
  name: '@team/review-skill',
  version: '1.0.0',
  description: 'Review skill',
  category: 'skill' as const,
  files: [{ src: 'SKILL.md', dest: 'skills/review/SKILL.md' }],
  dependencies: { '@team/base': '^1.0.0' },
  devDependencies: { '@team/create-ai-tool': '^1.0.0' },
};

describe('toPublishManifest', () => {
  it('extracts publish fields from a full unified doc', () => {
    const result = toPublishManifest(FULL_DOC);
    expect(result.name).toBe('@team/review-skill');
    expect(result.version).toBe('1.0.0');
    expect(result.dependencies).toEqual({ '@team/base': '^1.0.0' });
  });

  it('includes optional publish metadata when present', () => {
    const result = toPublishManifest({
      ...FULL_DOC,
      nativeFor: 'cursor',
      keywords: ['review'],
      author: 'team',
      repository: 'https://example.com/repo',
      tags: ['lint'],
      platforms: ['cursor'],
      private: true,
    });
    expect(result.nativeFor).toBe('cursor');
    expect(result.keywords).toEqual(['review']);
    expect(result.author).toBe('team');
    expect(result.repository).toBe('https://example.com/repo');
    expect(result.tags).toEqual(['lint']);
    expect(result.platforms).toEqual(['cursor']);
    expect(result.private).toBe(true);
  });

  it('omits devDependencies from registry payload', () => {
    const result = toPublishManifest(FULL_DOC);
    expect(result).not.toHaveProperty('devDependencies');
  });

  it('throws when publish fields are missing', () => {
    expect(() => toPublishManifest({ dependencies: { foo: '^1.0.0' } })).toThrow(/missing publish fields/i);
  });

  it('throws when publish subset fails tool manifest validation', () => {
    const invalid = {
      ...FULL_DOC,
      repository: 'not-a-valid-url',
    };
    expect(() => toPublishManifest(invalid)).toThrow(/Publish manifest validation failed/);
  });
});

describe('isPublishable', () => {
  it('returns true when category, version, and files are present', () => {
    expect(isPublishable(FULL_DOC)).toBe(true);
  });

  it('returns false for consumer-only doc', () => {
    expect(isPublishable({ name: 'my-app', dependencies: { foo: '^1.0.0' } })).toBe(false);
  });

  it('returns true for mcp-tool with empty files when mcpServer is present', () => {
    expect(
      isPublishable({
        name: '@team/server',
        version: '1.0.0',
        description: 'MCP',
        category: 'mcp-tool',
        files: [],
        mcpServer: { command: 'node', args: ['server.js'] },
      }),
    ).toBe(true);
  });
});

describe('AitoolsJsonSchema', () => {
  it('accepts consumer-only doc', () => {
    const parsed = AitoolsJsonSchema.safeParse({
      name: 'my-app',
      dependencies: { '@team/foo': '^1.0.0' },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts full publishable doc', () => {
    const parsed = AitoolsJsonSchema.safeParse(FULL_DOC);
    expect(parsed.success).toBe(true);
  });

  it('normalizes legacy tools and devTools keys', () => {
    const parsed = AitoolsJsonSchema.safeParse({
      tools: { foo: '^1.0.0' },
      devTools: { bar: '^2.0.0' },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dependencies).toEqual({ foo: '^1.0.0' });
      expect(parsed.data.devDependencies).toEqual({ bar: '^2.0.0' });
    }
  });
});

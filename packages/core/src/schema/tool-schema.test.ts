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
    for (const category of ['skill', 'subagent', 'prompt', 'mcp-tool']) {
      const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, category });
      expect(result.success).toBe(true);
    }
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
    const result = ToolManifestSchema.safeParse({ ...VALID_MANIFEST, category: 'plugin' });
    expect(result.success).toBe(false);
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
});

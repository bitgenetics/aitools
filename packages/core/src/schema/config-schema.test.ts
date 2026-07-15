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
import { AiToolsLockSchema, AitoolsJsonSchema, RegistryAuthSchema, RegistryConfigSchema } from '../schema/config-schema.js';

describe('RegistryAuthSchema — bearer', () => {
  it('accepts bearer auth with a token', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'bearer', token: 'abc123' }).success).toBe(true);
  });

  it('rejects bearer auth missing a token', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'bearer' }).success).toBe(false);
  });
});

describe('RegistryAuthSchema — basic', () => {
  it('accepts basic auth with both username and password', () => {
    expect(
      RegistryAuthSchema.safeParse({ type: 'basic', username: 'alice', password: 'secret' }).success,
    ).toBe(true);
  });

  it('rejects basic auth missing a password', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'basic', username: 'alice' }).success).toBe(false);
  });

  it('rejects basic auth missing a username', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'basic', password: 'secret' }).success).toBe(false);
  });

  it('rejects basic auth missing both username and password', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'basic' }).success).toBe(false);
  });
});

describe('RegistryConfigSchema — http', () => {
  it('accepts an explicit http registry config', () => {
    const result = RegistryConfigSchema.safeParse({
      type: 'http',
      name: 'team',
      url: 'https://registry.example.com',
      priority: 10,
    });
    expect(result.success).toBe(true);
  });

  it('treats configs without type as http for backward compatibility', () => {
    const result = RegistryConfigSchema.safeParse({
      name: 'legacy',
      url: 'https://registry.example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('http');
    }
  });

  it('rejects http registry configs with invalid URLs', () => {
    expect(
      RegistryConfigSchema.safeParse({ type: 'http', name: 'bad', url: 'not-a-url' }).success,
    ).toBe(false);
  });
});

describe('RegistryConfigSchema — git', () => {
  it('accepts a git registry config with SSH URL', () => {
    const result = RegistryConfigSchema.safeParse({
      type: 'git',
      name: 'team-tools',
      url: 'git@github.com:org/registry.git',
      readBranch: 'main',
      publishBranch: 'releases',
      path: 'registry/',
    });
    expect(result.success).toBe(true);
  });

  it('applies default branch and path values for git registries', () => {
    const result = RegistryConfigSchema.safeParse({
      type: 'git',
      name: 'team-tools',
      url: 'https://github.com/org/registry.git',
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'git') {
      expect(result.data.readBranch).toBe('main');
      expect(result.data.path).toBe('registry/');
    }
  });
});

describe('AiToolsLockSchema references', () => {
  it('accepts lock entries with vendored reference provenance', () => {
    const result = AiToolsLockSchema.safeParse({
      lockfileVersion: 1,
      tools: {
        myskill: {
          version: '1.0.0',
          resolved: 'https://registry.example/api/tools/myskill',
          integrity: 'sha256-abc',
          files: ['.cursor/skills/myskill/SKILL.md'],
          installedAt: '2026-07-15T12:00:00.000Z',
          references: {
            sharedref: {
              version: '2.1.0',
              resolved: 'https://registry.example/api/tools/sharedref',
              integrity: 'sha256-def',
              layout: 'named',
              installedAt: '2026-07-15T12:00:00.000Z',
              installs: [
                {
                  into: 'self',
                  destWithinCategory: 'myskill/references/sharedref',
                  files: ['.cursor/skills/myskill/references/sharedref/checklist.md'],
                },
              ],
            },
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('AitoolsJsonSchema referenceBindings', () => {
  it('accepts consumer referenceBindings overrides per package', () => {
    const result = AitoolsJsonSchema.safeParse({
      name: 'my-plugin',
      version: '1.0.0',
      description: 'Plugin with refs',
      category: 'plugin',
      files: [{ src: 'skills/review/SKILL.md', dest: 'skills/review/SKILL.md' }],
      references: { sharedref: { range: '^2.0.0', into: 'skills/review' } },
      referenceBindings: {
        'my-plugin': {
          sharedref: { into: ['skills/review', 'skills/audit'] },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

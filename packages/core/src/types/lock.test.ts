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
import { toLockEntry } from './lock.js';
import type { InstalledTool } from './tool.js';

const BASE_TOOL: InstalledTool = {
  name: 'my-skill',
  version: '1.0.0',
  category: 'skill',
  scope: 'project',
  platform: 'cursor',
  installedAt: '2024-01-01T00:00:00.000Z',
  files: ['.cursor/skills/my-skill/SKILL.md'],
  registry: 'https://registry.example.com',
  integrity: 'sha256-abc=',
};

describe('toLockEntry', () => {
  it('maps core installed-tool fields onto a lock entry', () => {
    const entry = toLockEntry(BASE_TOOL, 'https://registry.example.com/pkg.tgz');
    expect(entry.version).toBe('1.0.0');
    expect(entry.resolved).toBe('https://registry.example.com/pkg.tgz');
    expect(entry.files).toEqual(['.cursor/skills/my-skill/SKILL.md']);
    expect(entry.platform).toBe('cursor');
  });

  it('includes mcpKeys and mcpConfig when present', () => {
    const entry = toLockEntry(
      {
        ...BASE_TOOL,
        category: 'plugin',
        mcpKeys: ['plugin-db'],
        mcpConfig: '.cursor/mcp.json',
      },
      'https://registry.example.com/pkg.tgz',
    );
    expect(entry.mcpKeys).toEqual(['plugin-db']);
    expect(entry.mcpConfig).toBe('.cursor/mcp.json');
  });

  it('omits empty mcpKeys arrays', () => {
    const entry = toLockEntry({ ...BASE_TOOL, mcpKeys: [] }, 'https://registry.example.com/pkg.tgz');
    expect(entry.mcpKeys).toBeUndefined();
  });

  it('includes hooksAdded and hooksConfig when present', () => {
    const hooksAdded = { afterFileEdit: [{ command: 'echo hi' }] };
    const entry = toLockEntry(
      {
        ...BASE_TOOL,
        category: 'plugin',
        hooksAdded,
        hooksConfig: '.cursor/hooks.json',
      },
      'https://registry.example.com/pkg.tgz',
    );
    expect(entry.hooksAdded).toEqual(hooksAdded);
    expect(entry.hooksConfig).toBe('.cursor/hooks.json');
  });

  it('omits empty hooksAdded objects', () => {
    const entry = toLockEntry(
      { ...BASE_TOOL, hooksAdded: {}, hooksConfig: '.cursor/hooks.json' },
      'https://registry.example.com/pkg.tgz',
    );
    expect(entry.hooksAdded).toBeUndefined();
  });
});

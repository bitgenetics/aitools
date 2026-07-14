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
import {
  classifyPluginMembers,
  validatePluginStructure,
  parseCursorPluginJson,
} from './plugin-explode.js';

describe('classifyPluginMembers', () => {
  it('maps Cursor default component trees', () => {
    const { members, errors } = classifyPluginMembers({
      packageName: 'my-plugin',
      sources: [
        '.cursor-plugin/plugin.json',
        'skills/review/SKILL.md',
        'rules/style.mdc',
        'agents/bot.md',
        'commands/deploy.md',
        'mcp.json',
        'hooks/hooks.json',
      ],
    });
    expect(errors).toEqual([]);
    expect(members.find((m) => m.src === 'skills/review/SKILL.md')).toMatchObject({
      kind: 'skill',
      destWithinCategory: 'review/SKILL.md',
      fileCategory: 'skill',
    });
    expect(members.find((m) => m.src === 'rules/style.mdc')).toMatchObject({
      kind: 'rule',
      destWithinCategory: 'style.mdc',
    });
    expect(members.find((m) => m.src === 'mcp.json')?.kind).toBe('mcp');
    expect(members.find((m) => m.src === 'hooks/hooks.json')?.kind).toBe('hook');
    expect(members.find((m) => m.src === '.cursor-plugin/plugin.json')?.kind).toBe('skip');
  });

  it('keeps skill-local siblings under the skill member dest', () => {
    const { members, errors } = classifyPluginMembers({
      packageName: 'my-plugin',
      sources: ['skills/review/SKILL.md', 'skills/review/refs/notes.md'],
    });
    expect(errors).toEqual([]);
    expect(members.find((m) => m.src === 'skills/review/refs/notes.md')).toMatchObject({
      kind: 'skill',
      destWithinCategory: 'review/refs/notes.md',
    });
  });

  it('maps plugin-level assets and scripts to a synthetic skill package', () => {
    const { members, errors } = classifyPluginMembers({
      packageName: '@team/my-plugin',
      sources: ['scripts/format.sh', 'assets/logo.svg'],
    });
    expect(errors).toEqual([]);
    expect(members.find((m) => m.src === 'scripts/format.sh')).toMatchObject({
      kind: 'asset',
      destWithinCategory: '@team__my-plugin/scripts/format.sh',
      fileCategory: 'skill',
    });
    expect(members.find((m) => m.src === 'assets/logo.svg')).toMatchObject({
      kind: 'asset',
      destWithinCategory: '@team__my-plugin/assets/logo.svg',
    });
  });

  it('honours plugin.json path overrides', () => {
    const { members, errors } = classifyPluginMembers({
      packageName: 'my-plugin',
      sources: ['my-skills/foo/SKILL.md', 'custom-rules/a.mdc'],
      pluginJson: { skills: './my-skills/', rules: 'custom-rules/' },
    });
    expect(errors).toEqual([]);
    expect(members.find((m) => m.src === 'my-skills/foo/SKILL.md')?.kind).toBe('skill');
    expect(members.find((m) => m.src === 'custom-rules/a.mdc')?.kind).toBe('rule');
  });

  it('skips README and LICENSE', () => {
    const { members, errors } = classifyPluginMembers({
      packageName: 'my-plugin',
      sources: ['README.md', 'LICENSE', 'skills/x/SKILL.md'],
    });
    expect(errors).toEqual([]);
    expect(members.find((m) => m.src === 'README.md')?.kind).toBe('skip');
    expect(members.find((m) => m.src === 'LICENSE')?.kind).toBe('skip');
  });

  it('reports orphan paths as errors', () => {
    const { errors } = classifyPluginMembers({
      packageName: 'my-plugin',
      sources: ['random/orphan.bin'],
    });
    expect(errors).toEqual(['plugin file has no install home: random/orphan.bin']);
  });
});

describe('validatePluginStructure', () => {
  it('returns ok when every file has a home', () => {
    const result = validatePluginStructure({
      packageName: 'my-plugin',
      sources: ['.cursor-plugin/plugin.json', 'skills/a/SKILL.md', 'scripts/x.sh'],
    });
    expect(result.ok).toBe(true);
  });

  it('returns not ok for orphan paths', () => {
    const result = validatePluginStructure({
      packageName: 'my-plugin',
      sources: ['orphan.txt'],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('orphan.txt');
  });
});

describe('parseCursorPluginJson', () => {
  it('parses valid JSON', () => {
    expect(parseCursorPluginJson('{"name":"x","skills":"skills/"}')).toEqual({
      name: 'x',
      skills: 'skills/',
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseCursorPluginJson('{')).toBeNull();
  });
});

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
  anchorSkillName,
  analyzePluginPortability,
  renderSkillMap,
  extractSkillMapSkills,
  upsertSkillMapSection,
  scaffoldAnchorSkill,
  SKILL_MAP_BEGIN,
  SKILL_MAP_END,
} from './plugin-anchor.js';

describe('anchorSkillName', () => {
  it('returns the package name for a plain name', () => {
    expect(anchorSkillName('my-plugin')).toBe('my-plugin');
  });

  it('sanitizes a scoped package name into a directory segment', () => {
    expect(anchorSkillName('@team/my-plugin')).toBe('@team__my-plugin');
  });
});

describe('analyzePluginPortability', () => {
  it('grades an anchored multi-skill bundle transform-free', () => {
    const result = analyzePluginPortability({
      packageName: 'my-plugin',
      sources: [
        'skills/my-plugin/SKILL.md',
        'skills/my-plugin/references/methodology.md',
        'skills/researcher/SKILL.md',
      ],
    });
    expect(result.grade).toBe('transform-free');
    expect(result.hasAnchor).toBe(true);
    expect(result.memberSkills).toEqual(['researcher']);
    expect(result.findings.every((f) => f.kind === 'ok')).toBe(true);
  });

  it('grades root-level shared content rewrite-required', () => {
    const result = analyzePluginPortability({
      packageName: 'my-plugin',
      sources: ['skills/my-plugin/SKILL.md', 'assets/logo.svg'],
    });
    expect(result.grade).toBe('rewrite-required');
    expect(result.findings.some((f) => f.kind === 'root-shared-content')).toBe(true);
  });

  it('grades orphan files unsupported', () => {
    const result = analyzePluginPortability({
      packageName: 'my-plugin',
      sources: ['skills/my-plugin/SKILL.md', 'random/orphan.bin'],
    });
    expect(result.grade).toBe('unsupported');
    expect(result.findings.some((f) => f.kind === 'orphan')).toBe(true);
  });

  it('flags a missing anchor when skills exist without a hub named after the package', () => {
    const result = analyzePluginPortability({
      packageName: 'my-plugin',
      sources: ['skills/researcher/SKILL.md'],
    });
    expect(result.hasAnchor).toBe(false);
    expect(result.findings.some((f) => f.kind === 'missing-anchor')).toBe(true);
  });

  it('treats a root SKILL.md single-skill plugin as its own anchor', () => {
    const result = analyzePluginPortability({
      packageName: 'solo',
      sources: ['SKILL.md'],
    });
    expect(result.grade).toBe('transform-free');
    expect(result.hasAnchor).toBe(true);
    expect(result.memberSkills).toEqual([]);
  });
});

describe('skill-map section helpers', () => {
  it('renders member skills between managed markers', () => {
    const section = renderSkillMap('my-plugin', ['researcher', 'planner']);
    expect(section.startsWith(SKILL_MAP_BEGIN)).toBe(true);
    expect(section.trimEnd().endsWith(SKILL_MAP_END)).toBe(true);
    expect(section).toContain('`researcher`');
    expect(section).toContain('`planner`');
  });

  it('round-trips skill names via extractSkillMapSkills', () => {
    const section = renderSkillMap('my-plugin', ['researcher', 'planner']);
    expect(extractSkillMapSkills(section)).toEqual(['researcher', 'planner']);
  });

  it('replaces only the managed section and preserves author prose', () => {
    const original = `# my-plugin\n\nAuthor prose above.\n\n${renderSkillMap('my-plugin', ['old'])}\n\nAuthor prose below.\n`;
    const updated = upsertSkillMapSection(original, renderSkillMap('my-plugin', ['new']));
    expect(updated).toContain('Author prose above.');
    expect(updated).toContain('Author prose below.');
    expect(updated).toContain('`new`');
    expect(updated).not.toContain('`old`');
  });

  it('appends a managed section when none exists yet', () => {
    const updated = upsertSkillMapSection('# my-plugin\n\nJust prose.\n', renderSkillMap('my-plugin', []));
    expect(updated).toContain('Just prose.');
    expect(updated).toContain(SKILL_MAP_BEGIN);
  });
});

describe('scaffoldAnchorSkill', () => {
  it('produces frontmatter and a managed skill-map', () => {
    const content = scaffoldAnchorSkill('my-plugin', ['researcher']);
    expect(content).toContain('name: my-plugin');
    expect(content).toContain(SKILL_MAP_BEGIN);
    expect(content).toContain('`researcher`');
    expect(extractSkillMapSkills(content)).toEqual(['researcher']);
  });
});

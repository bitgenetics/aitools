// Copyright (C) 2026 Nucleic Logic Studios, LLC

import {
  derivePluginSkillIntoPaths,
  ReferenceInstallTargetError,
  resolveReferenceInstallTargets,
  skillFolderFromInto,
} from './install-targets.js';

describe('derivePluginSkillIntoPaths', () => {
  it('extracts skills/<name> from bundle sources', () => {
    expect(
      derivePluginSkillIntoPaths([
        'skills/review/SKILL.md',
        'skills/audit/SKILL.md',
        'rules/style.mdc',
      ]),
    ).toEqual(['skills/audit', 'skills/review']);
  });
});

describe('resolveReferenceInstallTargets', () => {
  it('defaults standalone skill to self folder', () => {
    expect(
      resolveReferenceInstallTargets({
        parentCategory: 'skill',
        binding: { range: '^2.0.0' },
        standaloneSkillDest: 'myskill',
      }),
    ).toEqual(['myskill']);
  });

  it('fan-outs plugin refs to multiple skill folders', () => {
    expect(
      resolveReferenceInstallTargets({
        parentCategory: 'plugin',
        binding: {
          range: '^2.0.0',
          into: ['skills/review', 'skills/audit'],
        },
      }),
    ).toEqual(['review', 'audit']);
  });

  it('expands all-skills from plugin bundle', () => {
    expect(
      resolveReferenceInstallTargets({
        parentCategory: 'plugin',
        binding: { range: '^2.0.0', into: 'all-skills' },
        pluginBundleSources: ['skills/review/SKILL.md', 'skills/site-check/SKILL.md'],
      }),
    ).toEqual(['review', 'site-check']);
  });

  it('requires explicit into for plugins', () => {
    expect(() =>
      resolveReferenceInstallTargets({
        parentCategory: 'plugin',
        binding: { range: '^2.0.0' },
      }),
    ).toThrow(ReferenceInstallTargetError);
  });

  it('rejects into plugin hub target', () => {
    expect(() =>
      resolveReferenceInstallTargets({
        parentCategory: 'plugin',
        binding: { range: '^2.0.0', into: 'plugin' },
      }),
    ).toThrow(/plugin/);
  });
});

describe('skillFolderFromInto', () => {
  it('maps skills/review to review', () => {
    expect(skillFolderFromInto('skills/review')).toBe('review');
  });

  it('maps self to standalone skill dest', () => {
    expect(skillFolderFromInto('self', 'myskill')).toBe('myskill');
  });
});

// Copyright (C) 2026 Nucleic Logic Studios, LLC

import {
  buildReferenceLockEntry,
  collectReferenceLockFilePaths,
  mergeReferenceBindings,
  parseReferenceDeclarations,
  planVendoredReferenceFiles,
  resolveReferenceInstallTargets,
  resolveReferenceLayout,
} from '../index.js';

/**
 * End-to-end planning flows for shared reference use cases (no filesystem I/O).
 */
describe('shared references use cases', () => {
  const SHARED_REF_FILES = ['checklist.md', 'sources.md', 'index.md'];

  it('standalone skill vendors sharedref with named layout', () => {
    const bindings = parseReferenceDeclarations({ '@acme/sharedref': '^2.0.0' });
    const binding = bindings['@acme/sharedref']!;
    const layout = resolveReferenceLayout(binding);
    const skillFolders = resolveReferenceInstallTargets({
      parentCategory: 'skill',
      binding,
      standaloneSkillDest: 'myskill',
    });

    expect(skillFolders).toEqual(['myskill']);

    const plan = planVendoredReferenceFiles({
      refPackageName: '@acme/sharedref',
      refFileDests: SHARED_REF_FILES,
      skillFolder: skillFolders[0]!,
      layout,
    });

    expect(plan.files.map((f) => f.destWithinCategory)).toEqual([
      'myskill/references/@acme__sharedref/checklist.md',
      'myskill/references/@acme__sharedref/sources.md',
    ]);
  });

  it('plugin fan-out installs one fetch into multiple skill reference folders', () => {
    const manifest = parseReferenceDeclarations({
      sharedref: {
        range: '^2.0.0',
        into: ['skills/review', 'skills/audit'],
      },
    });
    const binding = manifest.sharedref!;

    const skillFolders = resolveReferenceInstallTargets({
      parentCategory: 'plugin',
      binding,
      pluginBundleSources: ['skills/review/SKILL.md', 'skills/audit/SKILL.md'],
    });

    const plans = skillFolders.map((folder) =>
      planVendoredReferenceFiles({
        refPackageName: 'sharedref',
        refFileDests: SHARED_REF_FILES,
        skillFolder: folder,
        layout: resolveReferenceLayout(binding),
      }),
    );

    const lockEntry = buildReferenceLockEntry({
      refName: 'sharedref',
      version: '2.1.0',
      resolved: 'https://registry.example/api/tools/sharedref',
      integrity: 'sha256-test',
      layout: 'named',
      installedAt: '2026-07-15T12:00:00.000Z',
      skillCategoryBase: '.cursor/skills',
      intoLabels: ['skills/review', 'skills/audit'],
      plans,
    });

    expect(lockEntry.installs).toHaveLength(2);
    expect(lockEntry.installs[0]?.files[0]).toMatch(
      /\.cursor\/skills\/review\/references\/sharedref\/checklist\.md$/,
    );
    expect(lockEntry.installs[1]?.files[0]).toMatch(
      /\.cursor\/skills\/audit\/references\/sharedref\/checklist\.md$/,
    );
  });

  it('consumer referenceBindings override manifest into targets', () => {
    const manifest = parseReferenceDeclarations({
      sharedref: { range: '^2.0.0', into: 'skills/review' },
    });
    const merged = mergeReferenceBindings(manifest, {
      sharedref: { into: ['skills/review', 'skills/audit'] },
    });

    const binding = merged.sharedref!;
    const folders = resolveReferenceInstallTargets({
      parentCategory: 'plugin',
      binding,
    });

    expect(folders).toEqual(['review', 'audit']);
  });

  it('flat layout merges ref files into skill references root', () => {
    const binding = parseReferenceDeclarations({
      sharedref: { range: '^1.0.0', layout: 'flat' },
    }).sharedref!;

    const plan = planVendoredReferenceFiles({
      refPackageName: 'sharedref',
      refFileDests: SHARED_REF_FILES,
      skillFolder: 'myskill',
      layout: resolveReferenceLayout(binding),
    });

    expect(plan.files[0]?.destWithinCategory).toBe('myskill/references/checklist.md');
  });

  it('standalone skill with multiple named refs gets separate reference subdirs', () => {
    const bindings = parseReferenceDeclarations({
      sharedref: '^2.0.0',
      '@acme/a11y-checklist': '^1.0.0',
    });

    const plans = Object.entries(bindings).map(([refName, binding]) =>
      planVendoredReferenceFiles({
        refPackageName: refName,
        refFileDests: ['checklist.md'],
        skillFolder: 'myskill',
        layout: resolveReferenceLayout(binding),
      }),
    );

    expect(plans.map((p) => p.refDirName)).toEqual(['sharedref', '@acme__a11y-checklist']);
    expect(plans[0]?.files[0]?.destWithinCategory).toBe(
      'myskill/references/sharedref/checklist.md',
    );
    expect(plans[1]?.files[0]?.destWithinCategory).toBe(
      'myskill/references/@acme__a11y-checklist/checklist.md',
    );
  });

  it('plugin all-skills vendors ref into every skill folder in bundle', () => {
    const binding = parseReferenceDeclarations({
      sharedref: { range: '^2.0.0', into: 'all-skills' },
    }).sharedref!;

    const skillFolders = resolveReferenceInstallTargets({
      parentCategory: 'plugin',
      binding,
      pluginBundleSources: ['skills/review/SKILL.md', 'skills/site-check/SKILL.md'],
    });

    const plans = skillFolders.map((folder) =>
      planVendoredReferenceFiles({
        refPackageName: 'sharedref',
        refFileDests: ['checklist.md'],
        skillFolder: folder,
        layout: resolveReferenceLayout(binding),
      }),
    );

    expect(plans.map((p) => p.skillFolder)).toEqual(['review', 'site-check']);
    expect(plans[0]?.files[0]?.destWithinCategory).toBe('review/references/sharedref/checklist.md');
    expect(plans[1]?.files[0]?.destWithinCategory).toBe(
      'site-check/references/sharedref/checklist.md',
    );
  });

  it('uninstall gathers parent skill files and all reference install paths', () => {
    const plan = planVendoredReferenceFiles({
      refPackageName: '@acme/sharedref',
      refFileDests: SHARED_REF_FILES,
      skillFolder: 'myskill',
      layout: 'named',
    });

    const lockRefs = {
      sharedref: buildReferenceLockEntry({
        refName: 'sharedref',
        version: '2.1.0',
        resolved: 'https://registry.example/api/tools/sharedref',
        integrity: 'sha256-test',
        layout: 'named',
        installedAt: '2026-07-15T12:00:00.000Z',
        skillCategoryBase: '.cursor/skills',
        intoLabels: ['self'],
        plans: [plan],
      }),
    };

    const parentFiles = ['.cursor/skills/myskill/SKILL.md'];
    const referencePaths = collectReferenceLockFilePaths(lockRefs);
    const uninstallPaths = [...parentFiles, ...referencePaths];

    expect(uninstallPaths).toEqual([
      '.cursor/skills/myskill/SKILL.md',
      '.cursor/skills/myskill/references/@acme__sharedref/checklist.md',
      '.cursor/skills/myskill/references/@acme__sharedref/sources.md',
    ]);
  });
});

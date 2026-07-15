// Copyright (C) 2026 Nucleic Logic Studios, LLC

import {
  buildReferenceLockEntry,
  collectReferenceLockFilePaths,
} from './reference-lock.js';
import { planVendoredReferenceFiles } from './vendor-paths.js';

describe('buildReferenceLockEntry', () => {
  it('records installs[] per fan-out target for uninstall', () => {
    const reviewPlan = planVendoredReferenceFiles({
      refPackageName: '@acme/sharedref',
      refFileDests: ['checklist.md', 'sources.md'],
      skillFolder: 'review',
      layout: 'named',
    });
    const auditPlan = planVendoredReferenceFiles({
      refPackageName: '@acme/sharedref',
      refFileDests: ['checklist.md', 'sources.md'],
      skillFolder: 'audit',
      layout: 'named',
    });

    const entry = buildReferenceLockEntry({
      refName: 'sharedref',
      version: '2.1.0',
      resolved: 'https://registry.example/api/tools/sharedref',
      integrity: 'sha256-abc',
      layout: 'named',
      installedAt: '2026-07-15T12:00:00.000Z',
      skillCategoryBase: '.cursor/skills',
      intoLabels: ['skills/review', 'skills/audit'],
      plans: [reviewPlan, auditPlan],
    });

    expect(entry.installs).toHaveLength(2);
    expect(entry.installs[0]?.into).toBe('skills/review');
    expect(entry.installs[0]?.destWithinCategory).toBe('review/references/@acme__sharedref');
    expect(entry.installs[0]?.files).toContain(
      '.cursor/skills/review/references/@acme__sharedref/checklist.md',
    );
    expect(entry.installs[1]?.into).toBe('skills/audit');
  });
});

describe('collectReferenceLockFilePaths', () => {
  it('aggregates all vendored paths for uninstall', () => {
    const entry = buildReferenceLockEntry({
      refName: 'sharedref',
      version: '1.0.0',
      resolved: 'https://registry.example/api/tools/sharedref',
      integrity: 'sha256-abc',
      layout: 'named',
      installedAt: '2026-07-15T12:00:00.000Z',
      skillCategoryBase: '.cursor/skills',
      intoLabels: ['self'],
      plans: [
        planVendoredReferenceFiles({
          refPackageName: 'sharedref',
          refFileDests: ['checklist.md'],
          skillFolder: 'myskill',
          layout: 'named',
        }),
      ],
    });

    const paths = collectReferenceLockFilePaths({ sharedref: entry });
    expect(paths).toEqual(['.cursor/skills/myskill/references/sharedref/checklist.md']);
  });
});

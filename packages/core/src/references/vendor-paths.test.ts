// Copyright (C) 2026 Nucleic Logic Studios, LLC

import {
  planVendoredReferenceFiles,
  referencePackageContentDests,
  toProjectRelativePaths,
} from './vendor-paths.js';

describe('referencePackageContentDests', () => {
  it('excludes index.md metadata from vendored content', () => {
    expect(referencePackageContentDests(['checklist.md', 'sources.md', 'index.md'])).toEqual([
      'checklist.md',
      'sources.md',
    ]);
  });
});

describe('planVendoredReferenceFiles', () => {
  it('plans named layout under references/<refName>/ without nested references/', () => {
    const plan = planVendoredReferenceFiles({
      refPackageName: '@acme/sharedref',
      refFileDests: ['checklist.md', 'sources.md', 'index.md'],
      skillFolder: 'myskill',
      layout: 'named',
    });

    expect(plan.refDirName).toBe('@acme__sharedref');
    expect(plan.files).toEqual([
      {
        packageDest: 'checklist.md',
        destWithinCategory: 'myskill/references/@acme__sharedref/checklist.md',
      },
      {
        packageDest: 'sources.md',
        destWithinCategory: 'myskill/references/@acme__sharedref/sources.md',
      },
    ]);
  });

  it('plans flat layout directly under skill references/', () => {
    const plan = planVendoredReferenceFiles({
      refPackageName: 'sharedref',
      refFileDests: ['checklist.md', 'sources.md'],
      skillFolder: 'myskill',
      layout: 'flat',
    });

    expect(plan.files).toEqual([
      { packageDest: 'checklist.md', destWithinCategory: 'myskill/references/checklist.md' },
      { packageDest: 'sources.md', destWithinCategory: 'myskill/references/sources.md' },
    ]);
  });

  it('plans plugin fan-out paths per skill folder', () => {
    const review = planVendoredReferenceFiles({
      refPackageName: 'sharedref',
      refFileDests: ['checklist.md'],
      skillFolder: 'review',
      layout: 'named',
    });
    const audit = planVendoredReferenceFiles({
      refPackageName: 'sharedref',
      refFileDests: ['checklist.md'],
      skillFolder: 'audit',
      layout: 'named',
    });

    expect(review.files[0]?.destWithinCategory).toBe('review/references/sharedref/checklist.md');
    expect(audit.files[0]?.destWithinCategory).toBe('audit/references/sharedref/checklist.md');
  });
});

describe('toProjectRelativePaths', () => {
  it('prefixes skill category base for lock file paths', () => {
    const plan = planVendoredReferenceFiles({
      refPackageName: 'sharedref',
      refFileDests: ['checklist.md'],
      skillFolder: 'myskill',
      layout: 'named',
    });

    expect(toProjectRelativePaths('.cursor/skills', [plan])).toEqual([
      '.cursor/skills/myskill/references/sharedref/checklist.md',
    ]);
  });
});

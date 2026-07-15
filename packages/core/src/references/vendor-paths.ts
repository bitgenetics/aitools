// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { sanitizePackageDirName } from '../manifest/plugin-install.js';
import type { ReferenceLayout } from '../types/reference.js';

export interface VendoredReferenceFile {
  /** Path within the reference package (e.g. checklist.md). */
  packageDest: string;
  /** Path relative to the skill category install base (forward slashes). */
  destWithinCategory: string;
}

export interface VendoredReferencePlan {
  skillFolder: string;
  refDirName: string;
  layout: ReferenceLayout;
  files: VendoredReferenceFile[];
}

const METADATA_BASENAMES = new Set(['index.md', 'readme.md', 'license', 'license.md', 'license.txt']);

function normPackageDest(dest: string): string {
  return dest.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Content files from a reference package manifest (excludes metadata-only names). */
export function referencePackageContentDests(fileDests: string[]): string[] {
  return fileDests
    .map(normPackageDest)
    .filter((dest) => {
      const base = dest.split('/').pop()?.toLowerCase() ?? dest;
      return !METADATA_BASENAMES.has(base);
    });
}

/**
 * Plan flattened vendored paths for one skill folder.
 * Named: `{skill}/references/{refDir}/{file}`
 * Flat: `{skill}/references/{file}`
 */
export function planVendoredReferenceFiles(options: {
  refPackageName: string;
  refFileDests: string[];
  skillFolder: string;
  layout: ReferenceLayout;
}): VendoredReferencePlan {
  const refDirName = sanitizePackageDirName(options.refPackageName);
  const contentDests = referencePackageContentDests(options.refFileDests);

  const files: VendoredReferenceFile[] = contentDests.map((packageDest) => {
    const basename = packageDest.includes('/')
      ? packageDest.split('/').pop()!
      : packageDest;
    const destWithinCategory =
      options.layout === 'flat'
        ? `${options.skillFolder}/references/${basename}`
        : `${options.skillFolder}/references/${refDirName}/${basename}`;
    return { packageDest, destWithinCategory };
  });

  return {
    skillFolder: options.skillFolder,
    refDirName,
    layout: options.layout,
    files,
  };
}

/**
 * Build install paths under a project root (e.g. `.cursor/skills/...`).
 */
export function toProjectRelativePaths(
  skillCategoryBase: string,
  plans: VendoredReferencePlan[],
): string[] {
  const base = skillCategoryBase.replace(/\\/g, '/').replace(/\/$/, '');
  return plans.flatMap((plan) =>
    plan.files.map((f) => `${base}/${f.destWithinCategory}`.replace(/\/+/g, '/')),
  );
}

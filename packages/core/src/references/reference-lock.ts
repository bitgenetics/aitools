// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import type {
  ReferenceInstallLock,
  ReferenceLayout,
  ReferenceLockEntry,
} from '../types/reference.js';
import type { VendoredReferencePlan } from './vendor-paths.js';
import { toProjectRelativePaths } from './vendor-paths.js';

export interface BuildReferenceLockOptions {
  refName: string;
  version: string;
  resolved: string;
  integrity: string;
  layout: ReferenceLayout;
  installedAt: string;
  skillCategoryBase: string;
  /** Parallel to install into labels (e.g. `self`, `skills/review`). */
  intoLabels: string[];
  plans: VendoredReferencePlan[];
}

/**
 * Build lock `references.<name>` provenance from vendored install plans.
 */
export function buildReferenceLockEntry(opts: BuildReferenceLockOptions): ReferenceLockEntry {
  if (opts.intoLabels.length !== opts.plans.length) {
    throw new Error('intoLabels and plans must have the same length');
  }

  const installs: ReferenceInstallLock[] = opts.plans.map((plan, i) => {
    const projectFiles = toProjectRelativePaths(opts.skillCategoryBase, [plan]);
    const destPrefix =
      plan.layout === 'flat'
        ? `${plan.skillFolder}/references`
        : `${plan.skillFolder}/references/${plan.refDirName}`;

    return {
      into: opts.intoLabels[i] ?? 'self',
      destWithinCategory: destPrefix,
      files: projectFiles,
    };
  });

  return {
    version: opts.version,
    resolved: opts.resolved,
    integrity: opts.integrity,
    layout: opts.layout,
    installedAt: opts.installedAt,
    installs,
  };
}

/** Collect all project-relative file paths from reference lock entries for uninstall. */
export function collectReferenceLockFilePaths(
  references: Record<string, ReferenceLockEntry> | undefined,
): string[] {
  if (!references) return [];
  const paths: string[] = [];
  for (const entry of Object.values(references)) {
    for (const install of entry.installs) {
      paths.push(...install.files);
    }
  }
  return paths;
}

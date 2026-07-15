// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { REJECTED_REFERENCE_INTO_PLUGIN } from '../types/reference.js';
import type { ReferenceBinding } from '../types/reference.js';

export class ReferenceInstallTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceInstallTargetError';
  }
}

/**
 * Derive bundle-relative skill paths (`skills/review`) from plugin bundle sources.
 */
export function derivePluginSkillIntoPaths(bundleSources: string[]): string[] {
  const paths = new Set<string>();
  for (const raw of bundleSources) {
    const src = raw.replace(/\\/g, '/').replace(/^\.\//, '');
    const match = /^skills\/([^/]+)\/SKILL\.md$/i.exec(src);
    if (match) {
      paths.add(`skills/${match[1]}`);
    }
  }
  return [...paths].sort();
}

function normalizeIntoList(into: string | string[] | undefined): string[] {
  if (into === undefined) return [];
  return Array.isArray(into) ? into : [into];
}

function assertNotPluginInto(into: string): void {
  if (into === REJECTED_REFERENCE_INTO_PLUGIN) {
    throw new ReferenceInstallTargetError(
      `into: "${REJECTED_REFERENCE_INTO_PLUGIN}" is not supported — vend registry refs under skills/<name>/references/`,
    );
  }
}

/**
 * Map bundle-relative `into` path to skill folder name under the skills install category.
 * `skills/review` → `review`; `self` → standalone skill dest name.
 */
export function skillFolderFromInto(into: string, standaloneSkillDest?: string): string {
  assertNotPluginInto(into);
  if (into === 'self') {
    if (!standaloneSkillDest) {
      throw new ReferenceInstallTargetError('into: "self" requires standaloneSkillDest');
    }
    return standaloneSkillDest;
  }
  const normalized = into.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (normalized.startsWith('skills/')) {
    return normalized.slice('skills/'.length).split('/')[0] ?? normalized;
  }
  return normalized.split('/')[0] ?? normalized;
}

export interface ResolveInstallTargetsOptions {
  parentCategory: 'skill' | 'plugin';
  binding: ReferenceBinding;
  /** Plugin bundle `files[].src` paths for `all-skills` derivation. */
  pluginBundleSources?: string[];
  /** Standalone skill `dest` folder name (e.g. `myskill`). */
  standaloneSkillDest?: string;
}

/**
 * Resolve `into` targets to bundle-relative skill paths, then to skill folder names.
 */
export function resolveReferenceInstallTargets(opts: ResolveInstallTargetsOptions): string[] {
  const intoList = normalizeIntoList(opts.binding.into);

  let bundlePaths: string[];
  if (intoList.length === 0) {
    if (opts.parentCategory === 'skill') {
      bundlePaths = ['self'];
    } else {
      throw new ReferenceInstallTargetError(
        'plugin manifests must declare explicit into for each reference (string or string[])',
      );
    }
  } else {
    bundlePaths = intoList.flatMap((into) => {
      assertNotPluginInto(into);
      if (into === 'all-skills') {
        const derived = derivePluginSkillIntoPaths(opts.pluginBundleSources ?? []);
        if (derived.length === 0) {
          throw new ReferenceInstallTargetError(
            'into: "all-skills" found no skills/*/SKILL.md paths in the plugin bundle',
          );
        }
        return derived;
      }
      return [into];
    });
  }

  const folders = bundlePaths.map((p) =>
    skillFolderFromInto(p, opts.standaloneSkillDest),
  );

  return [...new Set(folders)];
}

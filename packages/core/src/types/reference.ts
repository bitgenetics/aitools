// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/** Layout for vendored reference files under a skill's references/ directory. */
export type ReferenceLayout = 'named' | 'flat';

/**
 * Declared reference dependency on a parent skill or plugin manifest.
 * Shorthand in manifests is a semver range string; parsed form uses this shape.
 */
export interface ReferenceBinding {
  range: string;
  /** Bundle-relative skill path(s), `self` for standalone skills, or `all-skills` for plugins. */
  into?: string | string[];
  layout?: ReferenceLayout;
}

/** Raw manifest value: semver shorthand or binding object. */
export type ReferenceBindingInput = string | ReferenceBinding;

/**
 * Partial binding for consumer `referenceBindings` overrides.
 * `range` is optional — manifest declaration supplies the default.
 */
export interface ReferenceBindingOverride {
  range?: string;
  into?: string | string[];
  layout?: ReferenceLayout;
}

/** Raw override value: semver shorthand or partial binding object. */
export type ReferenceBindingOverrideInput = string | ReferenceBindingOverride;

/** Single install location recorded in the lock file for a vendored reference. */
export interface ReferenceInstallLock {
  into: string;
  destWithinCategory: string;
  files: string[];
}

/** Lock provenance for one reference package vendored into a parent. */
export interface ReferenceLockEntry {
  version: string;
  resolved: string;
  integrity: string;
  layout?: ReferenceLayout;
  installedAt: string;
  installs: ReferenceInstallLock[];
}

/** Rejected install target — does not match Cursor plugin layout. */
export const REJECTED_REFERENCE_INTO_PLUGIN = 'plugin';

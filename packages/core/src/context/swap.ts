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
import fs from 'node:fs';
import path from 'node:path';
import type { AitoolsJson } from '../types/config.js';
import type { AiToolsLock } from '../types/lock.js';
import type { ToolManifest } from '../types/tool.js';
import { readAitoolsJson } from '../manifest/manifest-file.js';
import { readLockFile, writeLockFile } from '../lock/lock-file.js';
import { discoverAiMech, swappablePaths } from './discover.js';
import { quarantineFiles, restoreQuarantine, quarantineExists, ensureQuarantineRoot } from './quarantine.js';
import { assertCleanAiMechTree } from './dirty.js';
import {
  installContextProfileTree,
  removeContextProfileFiles,
  type ContextProfileInstallResult,
} from './profile-install.js';
import { inventoryPath } from './paths.js';
import type { AiToolsContextLock, ContextSwapMode, QuarantineManifest } from './types.js';

export interface SwapProfilePackage {
  manifest: ToolManifest;
  agentsDir: string;
  integrity: string;
  resolved: string;
}

export interface ContextSwapOptions {
  force?: boolean;
  /** Fetch+unpack profile package (CLI supplies this). */
  resolveProfile: (packageName: string) => Promise<SwapProfilePackage>;
}

export interface ContextSwapResult {
  profileName: string;
  mode: ContextSwapMode;
  quarantine: QuarantineManifest;
  installed: ContextProfileInstallResult;
}

export interface ContextRestoreOptions {
  force?: boolean;
  /** Install baseline package when quarantine is missing. */
  resolveBaseline?: (packageName: string) => Promise<SwapProfilePackage>;
}

export interface ContextRestoreResult {
  restoredFrom: 'quarantine' | 'baseline' | 'none';
  quarantineId?: string;
  baselinePackage?: string;
}

export interface ContextStatus {
  activeProfile: string | null;
  stayCount: number;
  quarantineId?: string;
  quarantinePresent: boolean;
  baselinePackage?: string;
  snapshotId?: string;
  profilePackage?: string;
  profileFiles?: number;
}

function loadManifest(projectRoot: string): AitoolsJson {
  return (readAitoolsJson(projectRoot) ?? {}) as AitoolsJson;
}

function writeInventory(projectRoot: string, stay?: string[]): void {
  const inventory = discoverAiMech(projectRoot, { stay });
  const file = inventoryPath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(inventory, null, 2) + '\n', 'utf8');
}

/**
 * Quarantine non-stay (overlay) or all cataloged (replace) paths, then install
 * the named profile package as a tree overlay. Updates lock.context.
 */
export async function swapContextProfile(
  projectRoot: string,
  profileName: string,
  options: ContextSwapOptions,
): Promise<ContextSwapResult> {
  const manifest = loadManifest(projectRoot);
  const profile = manifest.context?.profiles?.[profileName];
  if (!profile) {
    throw new Error(
      `Unknown context profile "${profileName}". Define it under aitools.json context.profiles.`,
    );
  }

  const stay = profile.mode === 'overlay' ? (manifest.context?.stay ?? []) : [];
  if (profile.mode === 'overlay' && stay.length === 0) {
    throw new Error(
      'Overlay mode requires an authored context.stay set in aitools.json ' +
        '(or run propose-context-stay + context accept-stay first).',
    );
  }

  const inventory = discoverAiMech(projectRoot, { stay });
  const toMove = swappablePaths(inventory, profile.mode);
  assertCleanAiMechTree(projectRoot, inventory.entries.map((e) => e.path), options.force === true);

  ensureQuarantineRoot(projectRoot);
  const quarantine = quarantineFiles(projectRoot, toMove);

  const pkg = await options.resolveProfile(profile.package);
  const installed = installContextProfileTree(projectRoot, pkg.agentsDir, pkg.manifest, {
    integrity: pkg.integrity,
    resolved: pkg.resolved,
  });

  const lock = readLockFile(projectRoot);
  const contextLock: AiToolsContextLock = {
    activeProfile: profileName,
    quarantineId: quarantine.id,
    moves: quarantine.moves,
    baselinePackage: manifest.context?.baseline?.package,
    snapshotId: manifest.context?.baseline?.snapshotId,
    profile: {
      name: profileName,
      package: profile.package,
      version: installed.version,
      resolved: installed.resolved,
      integrity: installed.integrity,
      files: installed.files,
      installedAt: new Date().toISOString(),
    },
  };
  const nextLock: AiToolsLock = { ...lock, context: contextLock };
  writeLockFile(projectRoot, nextLock);
  writeInventory(projectRoot, stay);

  return { profileName, mode: profile.mode, quarantine, installed };
}

/**
 * Remove active profile files and restore from local quarantine (primary).
 * Falls back to registry baseline package when quarantine is absent.
 */
export async function restoreContext(
  projectRoot: string,
  options: ContextRestoreOptions = {},
): Promise<ContextRestoreResult> {
  const lock = readLockFile(projectRoot);
  const ctx = lock.context;
  if (!ctx || ctx.activeProfile === null) {
    // Still allow restore if quarantine id present from a partial write
    if (!ctx?.quarantineId && !ctx?.baselinePackage) {
      throw new Error('No active context swap to restore (lock.context is empty).');
    }
  }

  const inventory = discoverAiMech(projectRoot, {
    stay: loadManifest(projectRoot).context?.stay,
  });
  assertCleanAiMechTree(
    projectRoot,
    inventory.entries.map((e) => e.path),
    options.force === true,
  );

  if (ctx?.profile?.files?.length) {
    removeContextProfileFiles(projectRoot, ctx.profile.files);
  }

  let restoredFrom: ContextRestoreResult['restoredFrom'] = 'none';
  let quarantineId = ctx?.quarantineId;
  let baselinePackage = ctx?.baselinePackage ?? loadManifest(projectRoot).context?.baseline?.package;

  if (quarantineId && quarantineExists(projectRoot, quarantineId)) {
    restoreQuarantine(projectRoot, quarantineId);
    restoredFrom = 'quarantine';
  } else if (baselinePackage && options.resolveBaseline) {
    const pkg = await options.resolveBaseline(baselinePackage);
    installContextProfileTree(projectRoot, pkg.agentsDir, pkg.manifest, {
      integrity: pkg.integrity,
      resolved: pkg.resolved,
    });
    restoredFrom = 'baseline';
  } else if (quarantineId) {
    throw new Error(
      `Quarantine "${quarantineId}" is missing and no baseline package is configured. ` +
        'Cannot restore AI-mech tree.',
    );
  }

  const nextLock: AiToolsLock = {
    ...lock,
    context: {
      activeProfile: null,
      baselinePackage,
      snapshotId: ctx?.snapshotId,
      fileHashes: ctx?.fileHashes,
    },
  };
  writeLockFile(projectRoot, nextLock);
  writeInventory(projectRoot, loadManifest(projectRoot).context?.stay);

  return { restoredFrom, quarantineId, baselinePackage };
}

export function getContextStatus(projectRoot: string): ContextStatus {
  const manifest = loadManifest(projectRoot);
  const lock = readLockFile(projectRoot);
  const ctx = lock.context;
  const quarantineId = ctx?.quarantineId;
  return {
    activeProfile: ctx?.activeProfile ?? null,
    stayCount: manifest.context?.stay?.length ?? 0,
    quarantineId,
    quarantinePresent: quarantineId ? quarantineExists(projectRoot, quarantineId) : false,
    baselinePackage: ctx?.baselinePackage ?? manifest.context?.baseline?.package,
    snapshotId: ctx?.snapshotId ?? manifest.context?.baseline?.snapshotId,
    profilePackage: ctx?.profile?.package,
    profileFiles: ctx?.profile?.files.length,
  };
}

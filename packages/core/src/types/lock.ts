import type { InstalledTool } from './tool.js';

/**
 * ai-tools-lock.json — exact resolved versions and file locations.
 * Analogous to package-lock.json. Should be committed to source control.
 */
export interface AiToolsLock {
  lockfileVersion: 1;
  /** Map of tool name → lock entry. */
  tools: Record<string, LockEntry>;
}

/**
 * Single entry in the lock file.
 */
export interface LockEntry {
  /** Exact resolved version (no ranges). */
  version: string;
  /** Full URL used to download the tarball. */
  resolved: string;
  /** SHA-256 integrity hash of the downloaded tarball (base64). */
  integrity: string;
  /** Absolute paths of every file written during installation. */
  files: string[];
  /** ISO-8601 installation timestamp. */
  installedAt: string;
}

/** Construct a lock entry from an InstalledTool record. */
export function toLockEntry(tool: InstalledTool, resolved: string): LockEntry {
  return {
    version: tool.version,
    resolved,
    integrity: tool.integrity,
    files: tool.files,
    installedAt: tool.installedAt,
  };
}

/** Construct an empty lock file. */
export function emptyLock(): AiToolsLock {
  return { lockfileVersion: 1, tools: {} };
}

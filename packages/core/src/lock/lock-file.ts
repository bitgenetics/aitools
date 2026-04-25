import fs from 'node:fs';
import path from 'node:path';
import type { AiToolsLock, LockEntry } from '../types/lock.js';
import { AiToolsLockSchema } from '../schema/config-schema.js';
import { emptyLock } from '../types/lock.js';

export const LOCK_FILENAME = 'ai-tools-lock.json';

/**
 * Read an ai-tools-lock.json from disk.
 * Returns an empty lock if the file does not exist.
 * Throws a descriptive error if the file exists but is malformed.
 */
export function readLockFile(dir: string): AiToolsLock {
  const filePath = path.join(dir, LOCK_FILENAME);
  if (!fs.existsSync(filePath)) {
    return emptyLock();
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${(err as Error).message}`);
  }
  const result = AiToolsLockSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid lock file at ${filePath}: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Write an ai-tools-lock.json to disk atomically (write → rename).
 */
export function writeLockFile(dir: string, lock: AiToolsLock): void {
  const filePath = path.join(dir, LOCK_FILENAME);
  const tmpPath = `${filePath}.tmp`;
  const content = JSON.stringify(lock, null, 2) + '\n';
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/** Add or update a single entry in the lock, returning a new lock object. */
export function upsertLockEntry(
  lock: AiToolsLock,
  name: string,
  entry: LockEntry,
): AiToolsLock {
  return {
    ...lock,
    tools: { ...lock.tools, [name]: entry },
  };
}

/** Remove an entry from the lock, returning a new lock object. */
export function removeLockEntry(lock: AiToolsLock, name: string): AiToolsLock {
  const tools = { ...lock.tools };
  delete tools[name];
  return { ...lock, tools };
}

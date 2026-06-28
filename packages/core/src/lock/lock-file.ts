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
import type { AiToolsLock, LockEntry } from '../types/lock.js';
import { AiToolsLockSchema } from '../schema/config-schema.js';
import { emptyLock } from '../types/lock.js';

export const LOCK_FILENAME = 'aitools-lock.json';

/**
 * Read an aitools-lock.json from disk.
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
 * Write an aitools-lock.json to disk atomically (write ? rename).
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

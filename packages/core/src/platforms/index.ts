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
import type { TargetPlatform } from '../types/tool.js';
import type { PlatformSpec } from './types.js';
import { universalSpec } from './universal.js';
import { vscodeSpec } from './vscode.js';
import { cursorSpec } from './cursor.js';
import { claudeSpec } from './claude.js';
import { windsurfSpec } from './windsurf.js';

export type { PlatformSpec, SkillFieldSpec, FieldSupport, InstallPathSpec } from './types.js';
export { universalSpec } from './universal.js';
export { vscodeSpec } from './vscode.js';
export { cursorSpec } from './cursor.js';
export { claudeSpec } from './claude.js';
export { windsurfSpec } from './windsurf.js';

/** All known platform specs, keyed by platform ID. */
export const PLATFORM_SPECS: Record<TargetPlatform, PlatformSpec> = {
  universal: universalSpec,
  vscode:    vscodeSpec,
  cursor:    cursorSpec,
  claude:    claudeSpec,
  windsurf:  windsurfSpec,
};

/** Staleness threshold in days — specs older than this produce a warning. */
export const SPEC_STALE_DAYS = 90;

/**
 * Returns true when the spec's lastVerified date is more than SPEC_STALE_DAYS old.
 */
export function isSpecStale(spec: PlatformSpec): boolean {
  const verified = new Date(spec.lastVerified);
  const ageMs = Date.now() - verified.getTime();
  return ageMs > SPEC_STALE_DAYS * 24 * 60 * 60 * 1000;
}

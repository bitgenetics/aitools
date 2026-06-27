// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import type { TargetPlatform } from '@aitools/core';
import type { PlatformAdapter } from './types.js';
import { UniversalAdapter } from './universal.js';
import { VsCodeAdapter } from './vscode.js';
import { ClaudeAdapter } from './claude.js';
import { CursorAdapter } from './cursor.js';
import { WindsurfAdapter } from './windsurf.js';

export { UniversalAdapter } from './universal.js';
export { VsCodeAdapter } from './vscode.js';
export { ClaudeAdapter } from './claude.js';
export { CursorAdapter } from './cursor.js';
export { WindsurfAdapter } from './windsurf.js';
export type { PlatformAdapter } from './types.js';

const ADAPTERS: Record<TargetPlatform, PlatformAdapter> = {
  universal: new UniversalAdapter(),
  vscode:    new VsCodeAdapter(),
  claude:    new ClaudeAdapter(),
  cursor:    new CursorAdapter(),
  windsurf:  new WindsurfAdapter(),
};

/**
 * Return the platform adapter for the given platform string.
 * Defaults to the universal adapter when no platform is specified.
 */
export function getAdapter(platform: TargetPlatform = 'universal'): PlatformAdapter {
  return ADAPTERS[platform];
}

import type { TargetPlatform } from '@ai-tools/core';
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

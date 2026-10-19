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
import type { ContentVendor, HookEvents, TargetPlatform } from '@bitgenetics/aitools-core';
import {
  convertHookEvents,
  isContentVendor,
  nonEmptyHookEvents,
  readHooksFile,
  writeHooksFile,
} from '@bitgenetics/aitools-core';
import type { TransformConfidence, TransformResult } from './types.js';
import { nativeResult, passthrough } from './types.js';

/** More dropped items than this means the result needs a human pass. */
const LOW_CONFIDENCE_WARNING_COUNT = 3;

const INVALID_HOOK_JSON: TransformResult = {
  content: '',
  confidence: 'unsupported',
  warnings: ['Invalid hook JSON'],
  skillPrompt: '/aitools-convert — fix malformed hook config',
};

function hookConfidence(warnings: string[]): TransformConfidence {
  if (warnings.length > LOW_CONFIDENCE_WARNING_COUNT) return 'low';
  return warnings.length > 0 ? 'medium' : 'high';
}

/** Convert a hooks file between vendor formats. JSON output is never annotated. */
export function transformHook(content: string, from: TargetPlatform, to: TargetPlatform): TransformResult {
  if (from === to) return nativeResult(content);
  if (!isContentVendor(from) || !isContentVendor(to)) return passthrough(content);

  let events: HookEvents;
  try {
    events = readHooksFile(content, from).events;
  } catch {
    return INVALID_HOOK_JSON;
  }

  const conversion = convertHookEvents(events, from, to);
  if (conversion.unsupported) {
    return {
      content: '',
      confidence: 'unsupported',
      warnings: conversion.warnings,
      skillPrompt: '/aitools-convert — no portable hooks remained after transformation',
    };
  }
  return {
    content: writeHooksFile(conversion.events, to),
    confidence: hookConfidence(conversion.warnings),
    warnings: conversion.warnings,
  };
}

function hooksVendor(platform: TargetPlatform): ContentVendor {
  if (!isContentVendor(platform)) {
    throw new Error('The universal platform has no hooks file');
  }
  return platform;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function readExisting(existingContent: string | null, vendor: ContentVendor): { events: HookEvents; rest: Record<string, unknown> } {
  if (!existingContent) return { events: {}, rest: {} };
  try {
    return readHooksFile(existingContent, vendor);
  } catch {
    return { events: {}, rest: {} };
  }
}

/** Append incoming hook handlers to a platform hooks file, keeping its other keys. */
export function mergeHookConfigs(
  existingContent: string | null,
  incomingContent: string,
  platform: TargetPlatform,
): string {
  const vendor = hooksVendor(platform);
  const existing = readExisting(existingContent, vendor);

  let incoming: HookEvents;
  try {
    incoming = readHooksFile(incomingContent, vendor).events;
  } catch {
    process.stderr.write('[aitools] Skipping invalid hook JSON\n');
    return existingContent ? ensureTrailingNewline(existingContent) : writeHooksFile({}, vendor);
  }

  const merged: HookEvents = { ...existing.events };
  for (const [event, handlers] of Object.entries(incoming)) {
    merged[event] = [...(merged[event] ?? []), ...handlers];
  }
  return writeHooksFile(merged, vendor, existing.rest);
}

/**
 * Remove previously appended hook handlers from a shared hooks config.
 * Handlers are matched by deep JSON equality against `added`.
 */
export function unmergeHookConfigs(
  existingContent: string,
  added: Record<string, unknown[]>,
  platform: TargetPlatform,
): string {
  const vendor = hooksVendor(platform);
  let existing: { events: HookEvents; rest: Record<string, unknown> };
  try {
    existing = readHooksFile(existingContent, vendor);
  } catch {
    return existingContent;
  }

  const remaining: HookEvents = { ...existing.events };
  for (const [event, handlers] of Object.entries(added)) {
    const current = remaining[event];
    if (!current) continue;
    const toRemove = new Set(handlers.map((h) => JSON.stringify(h)));
    const kept = current.filter((h) => !toRemove.has(JSON.stringify(h)));
    if (kept.length === 0) {
      delete remaining[event];
    } else {
      remaining[event] = kept;
    }
  }
  return writeHooksFile(remaining, vendor, existing.rest);
}

/** Extract hook event→handlers map from raw hook file content. */
export function extractHooksAdded(
  incomingContent: string,
  platform: TargetPlatform,
): Record<string, unknown[]> {
  try {
    return nonEmptyHookEvents(incomingContent, hooksVendor(platform));
  } catch {
    process.stderr.write('[aitools] Skipping invalid hook JSON\n');
    return {};
  }
}

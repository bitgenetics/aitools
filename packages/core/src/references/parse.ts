// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import type {
  ReferenceBinding,
  ReferenceBindingInput,
  ReferenceBindingOverride,
  ReferenceBindingOverrideInput,
  ReferenceLayout,
} from '../types/reference.js';

export interface ParsedReferenceDeclarations {
  [refName: string]: ReferenceBinding;
}

/**
 * Normalize manifest `references` shorthand (`"^1.0.0"`) to binding objects.
 */
export function parseReferenceDeclarations(
  references: Record<string, ReferenceBindingInput> | undefined,
): ParsedReferenceDeclarations {
  if (!references) return {};
  const out: ParsedReferenceDeclarations = {};
  for (const [name, value] of Object.entries(references)) {
    out[name] = parseReferenceBinding(value);
  }
  return out;
}

export function parseReferenceBinding(input: ReferenceBindingInput): ReferenceBinding {
  if (typeof input === 'string') {
    return { range: input };
  }
  return {
    range: input.range,
    ...(input.into !== undefined ? { into: input.into } : {}),
    ...(input.layout !== undefined ? { layout: input.layout } : {}),
  };
}

export function parseReferenceBindingOverride(
  input: ReferenceBindingOverrideInput,
): ReferenceBindingOverride {
  if (typeof input === 'string') {
    return { range: input };
  }
  return {
    ...(input.range !== undefined ? { range: input.range } : {}),
    ...(input.into !== undefined ? { into: input.into } : {}),
    ...(input.layout !== undefined ? { layout: input.layout } : {}),
  };
}

/**
 * Merge consumer `referenceBindings` overrides onto parsed manifest declarations.
 * Override wins per reference name.
 */
export function mergeReferenceBindings(
  manifest: ParsedReferenceDeclarations,
  overrides: Record<string, ReferenceBindingOverrideInput> | undefined,
): ParsedReferenceDeclarations {
  if (!overrides || Object.keys(overrides).length === 0) return { ...manifest };
  const merged = { ...manifest };
  for (const [name, value] of Object.entries(overrides)) {
    const base = merged[name];
    const parsed = parseReferenceBindingOverride(value);
    if (base) {
      merged[name] = {
        range: parsed.range ?? base.range,
        into: parsed.into !== undefined ? parsed.into : base.into,
        layout: parsed.layout !== undefined ? parsed.layout : base.layout,
      };
    } else if (parsed.range !== undefined) {
      merged[name] = {
        range: parsed.range,
        ...(parsed.into !== undefined ? { into: parsed.into } : {}),
        ...(parsed.layout !== undefined ? { layout: parsed.layout } : {}),
      };
    }
  }
  return merged;
}

export function resolveReferenceLayout(binding: ReferenceBinding): ReferenceLayout {
  return binding.layout ?? 'named';
}

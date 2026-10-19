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

/** Platforms that define their own file formats. `universal` is a placement convention only. */
export type ContentVendor = Exclude<TargetPlatform, 'universal'>;

export const CONTENT_VENDORS: readonly ContentVendor[] = ['cursor', 'vscode', 'claude', 'windsurf'];

export function isContentVendor(platform: TargetPlatform): platform is ContentVendor {
  return platform !== 'universal';
}

/** Result of converting one vendor's file content to another vendor's format. */
export interface VendorConversion {
  content: string;
  /** Extension the target vendor expects for this category, e.g. ".instructions.md". */
  extension: string;
  /** Each warning names information the target format cannot carry. Empty means lossless. */
  warnings: string[];
  /** True when the target vendor has no equivalent for the category; `content` is empty. */
  unsupported: boolean;
}

/** A frontmatter field that only one vendor's format defines. */
export interface VendorField {
  field: string;
  vendor: ContentVendor;
}

/**
 * Keep only the fields `known` lists, warning once per dropped field.
 */
export function pickKnownFields(
  fields: Record<string, unknown>,
  known: ReadonlySet<string>,
  to: ContentVendor,
  warnings: string[],
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (known.has(key)) {
      kept[key] = value;
    } else {
      warnings.push(`Dropped frontmatter field "${key}" (no ${to} equivalent)`);
    }
  }
  return kept;
}

/**
 * Fields that one vendor defines but the category's common set does not.
 * Used to detect vendor-flavoured content in packages that claim no `nativeFor`.
 */
export function vendorOnlyFields(
  fields: Record<string, unknown>,
  byVendor: Record<ContentVendor, readonly string[]>,
  common: ReadonlySet<string>,
): VendorField[] {
  const found: VendorField[] = [];
  for (const field of Object.keys(fields)) {
    if (common.has(field)) continue;
    for (const vendor of CONTENT_VENDORS) {
      if (byVendor[vendor].includes(field)) {
        found.push({ field, vendor });
        break;
      }
    }
  }
  return found;
}

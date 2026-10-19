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
import type { VendorField } from './types.js';
import { parseFrontmatter } from './frontmatter.js';
import { vendorRuleFields } from './rule.js';
import { vendorAgentFields } from './agent.js';
import { vendorCommandFields } from './command.js';

/** Categories whose markdown carries vendor frontmatter. */
export type FrontmatterCategory = 'rule' | 'agent' | 'command';

/**
 * Frontmatter fields in `content` that only one vendor defines. A package that carries such
 * fields is written for that vendor and should declare it as `nativeFor`.
 */
export function detectVendorFrontmatter(content: string, category: FrontmatterCategory): VendorField[] {
  const doc = parseFrontmatter(content);
  if (!doc.hasFrontmatter || doc.error) return [];
  switch (category) {
    case 'rule':
      return vendorRuleFields(doc.fields);
    case 'agent':
      return vendorAgentFields(doc.fields);
    case 'command':
      return vendorCommandFields(doc.fields);
  }
}

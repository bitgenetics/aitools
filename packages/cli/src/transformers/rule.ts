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
import type { TargetPlatform } from '@bitgenetics/aitools-core';
import { convertRule, isContentVendor } from '@bitgenetics/aitools-core';
import type { TransformResult } from './types.js';
import { markdownResult, nativeResult, passthrough } from './types.js';

/** Convert a rule file between vendor formats; the field mapping lives in core formats. */
export function transformRule(content: string, from: TargetPlatform, to: TargetPlatform): TransformResult {
  if (from === to) return nativeResult(content);
  if (!isContentVendor(from) || !isContentVendor(to)) return passthrough(content);
  return markdownResult(convertRule(content, from, to), 'rule', to);
}

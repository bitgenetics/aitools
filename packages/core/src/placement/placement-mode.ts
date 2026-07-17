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
import type { PlacementMode, ToolFile } from '../types/tool.js';

/** Default when `placementMode` is omitted from a files[] entry. */
export const DEFAULT_PLACEMENT_MODE: PlacementMode = 'strict';

/** Resolve effective placement mode for a file entry. */
export function effectivePlacementMode(
  file: Pick<ToolFile, 'placementMode'> | undefined,
): PlacementMode {
  return file?.placementMode ?? DEFAULT_PLACEMENT_MODE;
}

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
import {
  REGISTRY_MANIFEST_FILENAME,
  LEGACY_REGISTRY_MANIFEST_FILENAME,
} from './manifest-constants.js';

/** Registry manifest filenames in read order (new, then legacy). */
export const REGISTRY_MANIFEST_CANDIDATES = [
  REGISTRY_MANIFEST_FILENAME,
  LEGACY_REGISTRY_MANIFEST_FILENAME,
] as const;

/** Pick the first registry manifest filename that exists in versionDir. */
export function pickRegistryManifestBasename(exists: (basename: string) => boolean): string | null {
  for (const name of REGISTRY_MANIFEST_CANDIDATES) {
    if (exists(name)) return name;
  }
  return null;
}

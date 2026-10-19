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
/** Vendor file suffixes, longest first so compound suffixes are stripped whole. */
const VENDOR_SUFFIXES = ['.instructions.md', '.prompt.md', '.agent.md', '.mdc', '.md'] as const;

/** Replace a filename's vendor suffix (or plain extension) with `extension`. */
export function replaceVendorExtension(filename: string, extension: string): string {
  const lower = filename.toLowerCase();
  for (const suffix of VENDOR_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return filename.slice(0, filename.length - suffix.length) + extension;
    }
  }
  const lastDot = filename.lastIndexOf('.');
  const lastSlash = filename.lastIndexOf('/');
  return (lastDot > lastSlash ? filename.slice(0, lastDot) : filename) + extension;
}

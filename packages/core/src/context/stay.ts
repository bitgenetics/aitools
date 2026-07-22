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

/** Normalize to project-relative POSIX path without leading ./ */
export function toProjectRel(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

// Match a project-relative path against a simple stay glob.
// Supports exact paths, *, **, dir/** style prefixes, and **/name style globs.
export function matchStayGlob(pattern: string, filePath: string): boolean {
  const pat = toProjectRel(pattern);
  const file = toProjectRel(filePath);
  if (pat === file) return true;
  if (pat.endsWith('/**')) {
    const prefix = pat.slice(0, -3);
    if (prefix === '') return true;
    return file === prefix || file.startsWith(prefix + '/');
  }
  const regex = globToRegExp(pat);
  return regex.test(file);
}

function globToRegExp(pattern: string): RegExp {
  let i = 0;
  let out = '^';
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 2;
      if (pattern[i] === '/') i += 1;
      continue;
    }
    if (pattern[i] === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    if (pattern[i] === '?') {
      out += '[^/]';
      i += 1;
      continue;
    }
    const ch = pattern[i]!;
    if (/[.+^${}()|[\]\\]/.test(ch)) out += '\\' + ch;
    else out += ch;
    i += 1;
  }
  out += '$';
  return new RegExp(out);
}

/** True when any stay pattern matches the path. */
export function isStayPath(filePath: string, stay: string[] | undefined): boolean {
  if (!stay || stay.length === 0) return false;
  return stay.some((g) => matchStayGlob(g, filePath));
}

/** Deduplicate and normalize stay globs for authored config. */
export function normalizeStayList(stay: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stay) {
    const n = toProjectRel(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

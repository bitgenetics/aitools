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
import os from 'node:os';
import path from 'node:path';
import { resolveStoredPath, toPosixPath, toStoredPath } from './stored-path.js';

const HOME = path.join(os.tmpdir(), 'aitools-home');
const ROOT = path.join(os.tmpdir(), 'aitools-project');

describe('toPosixPath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(toPosixPath('a\\b\\c')).toBe('a/b/c');
  });
});

describe('toStoredPath', () => {
  it('returns already-relative paths with forward slashes', () => {
    expect(toStoredPath(ROOT, '.agents/skills/foo/SKILL.md')).toBe('.agents/skills/foo/SKILL.md');
    expect(toStoredPath(ROOT, '.agents\\skills\\foo\\SKILL.md')).toBe('.agents/skills/foo/SKILL.md');
  });

  it('stores project files relative to the project root', () => {
    const abs = path.join(ROOT, '.agents', 'skills', 'foo', 'SKILL.md');
    expect(toStoredPath(ROOT, abs, HOME)).toBe('.agents/skills/foo/SKILL.md');
  });

  it('stores user-scope files with a ~/ prefix', () => {
    const abs = path.join(HOME, '.cursor', 'skills', 'foo', 'SKILL.md');
    expect(toStoredPath(ROOT, abs, HOME)).toBe('~/.cursor/skills/foo/SKILL.md');
  });

  it('normalizes ~/ prefixes', () => {
    expect(toStoredPath(ROOT, '~/.cursor/skills/foo/SKILL.md', HOME)).toBe(
      '~/.cursor/skills/foo/SKILL.md',
    );
  });

  it('converts legacy absolute project paths to relative form', () => {
    const abs = path.resolve(ROOT, '.github', 'agents', 'subagent.md');
    expect(toStoredPath(ROOT, abs, HOME)).toBe('.github/agents/subagent.md');
  });
});

describe('resolveStoredPath', () => {
  it('resolves project-relative stored paths', () => {
    expect(resolveStoredPath(ROOT, '.agents/skills/foo/SKILL.md', HOME)).toBe(
      path.join(ROOT, '.agents', 'skills', 'foo', 'SKILL.md'),
    );
  });

  it('resolves ~/ stored paths against the home directory', () => {
    expect(resolveStoredPath(ROOT, '~/.cursor/skills/foo/SKILL.md', HOME)).toBe(
      path.join(HOME, '.cursor', 'skills', 'foo', 'SKILL.md'),
    );
  });

  it('accepts legacy absolute paths', () => {
    const abs = path.join(ROOT, 'legacy.md');
    expect(resolveStoredPath(ROOT, abs, HOME)).toBe(abs);
  });
});

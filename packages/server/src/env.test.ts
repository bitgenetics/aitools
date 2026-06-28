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
import { describe, it, expect, afterEach } from '@jest/globals';
import { readEnv, readOrgHeader } from './env.js';

describe('readEnv', () => {
  const key = 'AITOOLS_TEST_READ_ENV';

  afterEach(() => {
    delete process.env[key];
  });

  it('returns undefined when the variable is unset', () => {
    delete process.env[key];
    expect(readEnv(key)).toBeUndefined();
  });

  it('returns undefined when the variable is an empty string', () => {
    process.env[key] = '';
    expect(readEnv(key)).toBeUndefined();
  });

  it('returns the value when set', () => {
    process.env[key] = 'hello';
    expect(readEnv(key)).toBe('hello');
  });
});

describe('readOrgHeader', () => {
  it('returns undefined when header is missing', () => {
    expect(readOrgHeader({})).toBeUndefined();
  });

  it('returns undefined when header is not a string', () => {
    expect(readOrgHeader({ 'x-aitools-org': ['a', 'b'] })).toBeUndefined();
  });

  it('returns trimmed org name', () => {
    expect(readOrgHeader({ 'x-aitools-org': '  my-org  ' })).toBe('my-org');
  });

  it('returns undefined for whitespace-only header', () => {
    expect(readOrgHeader({ 'x-aitools-org': '   ' })).toBeUndefined();
  });
});

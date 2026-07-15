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
import { resolvePlatformOption } from './platform-option.js';

describe('resolvePlatformOption', () => {
  it('returns undefined when platform is omitted', () => {
    expect(resolvePlatformOption(undefined)).toBeUndefined();
  });

  it('returns a known platform when valid', () => {
    expect(resolvePlatformOption('cursor')).toBe('cursor');
  });

  it('exits when platform is unknown', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit:1');
    }) as never);
    expect(() => resolvePlatformOption('not-a-platform')).toThrow('process.exit:1');
    exitSpy.mockRestore();
  });
});

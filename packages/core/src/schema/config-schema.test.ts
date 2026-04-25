// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import { RegistryAuthSchema } from '../schema/config-schema.js';

describe('RegistryAuthSchema — bearer', () => {
  it('accepts bearer auth with a token', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'bearer', token: 'abc123' }).success).toBe(true);
  });

  it('rejects bearer auth missing a token', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'bearer' }).success).toBe(false);
  });
});

describe('RegistryAuthSchema — basic', () => {
  it('accepts basic auth with both username and password', () => {
    expect(
      RegistryAuthSchema.safeParse({ type: 'basic', username: 'alice', password: 'secret' }).success,
    ).toBe(true);
  });

  it('rejects basic auth missing a password', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'basic', username: 'alice' }).success).toBe(false);
  });

  it('rejects basic auth missing a username', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'basic', password: 'secret' }).success).toBe(false);
  });

  it('rejects basic auth missing both username and password', () => {
    expect(RegistryAuthSchema.safeParse({ type: 'basic' }).success).toBe(false);
  });
});

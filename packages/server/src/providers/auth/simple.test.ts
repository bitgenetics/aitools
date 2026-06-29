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
import { describe, it, expect } from '@jest/globals';
import { SimpleAuthProvider } from './simple.js';

describe('SimpleAuthProvider', () => {
  it('allows anonymous publish when no tokens are configured', async () => {
    const provider = new SimpleAuthProvider();
    const result = await provider.publisher.resolve({});
    expect(result).toEqual({ ok: true, publisher: { userId: 'anonymous', org: 'default' } });
  });

  it('requires legacy publish token when configured', async () => {
    const provider = new SimpleAuthProvider(undefined, 'legacy-token');
    const denied = await provider.publisher.resolve({ authorization: 'Bearer wrong' });
    expect(denied).toEqual({ ok: false, statusCode: 401, error: 'Unauthorized' });

    const allowed = await provider.publisher.resolve({ authorization: 'Bearer legacy-token' });
    expect(allowed).toEqual({ ok: true, publisher: { userId: 'anonymous', org: 'default' } });
  });

  it('uses publisher token mapping when configured', async () => {
    const provider = new SimpleAuthProvider({
      tokens: {
        mapped: { userId: 'alice', orgs: ['team-a'] },
      },
    });
    const result = await provider.publisher.resolve({ authorization: 'Bearer mapped' });
    expect(result).toEqual({ ok: true, publisher: { userId: 'alice', org: 'team-a' } });
  });

  it('creates and validates admin sessions', async () => {
    const provider = new SimpleAuthProvider(undefined, undefined, 'admin-secret');
    const sessionId = await provider.admin.createSession!('admin-secret');
    expect(sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await provider.admin.check({ cookies: { admin_session: sessionId! }, headers: {} }),
    ).toBe(true);
  });
});

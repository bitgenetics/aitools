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
import { describe, it, expect, jest } from '@jest/globals';
import { DatabaseAuthProvider } from './database.js';
import type { UserStore } from '../../storage/user-store.js';

function createMockUserStore(): jest.Mocked<UserStore> {
  return {
    createUser: jest.fn(),
    getUserByUsername: jest.fn(),
    loginUser: jest.fn(),
    createToken: jest.fn(),
    resolveToken: jest.fn(),
    listTokens: jest.fn(),
    deleteToken: jest.fn(),
    resolveFromHeaders: jest.fn(),
  } as unknown as jest.Mocked<UserStore>;
}

describe('DatabaseAuthProvider', () => {
  it('delegates publisher auth to userStore.resolveFromHeaders', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: '1', org: 'team-a' },
    });
    const provider = new DatabaseAuthProvider(userStore, 'admin-secret');
    const result = await provider.publisher.resolve({ authorization: 'Bearer tok' });
    expect(userStore.resolveFromHeaders).toHaveBeenCalledWith({ authorization: 'Bearer tok' });
    expect(result).toEqual({ ok: true, publisher: { userId: '1', org: 'team-a' } });
  });

  it('returns false from admin.check when admin token is not configured', async () => {
    const provider = new DatabaseAuthProvider(createMockUserStore());
    expect(await provider.admin.check({ headers: { 'x-admin-token': 'secret' } })).toBe(false);
  });

  it('accepts matching x-admin-token header', async () => {
    const provider = new DatabaseAuthProvider(createMockUserStore(), 'admin-secret');
    expect(await provider.admin.check({ headers: { 'x-admin-token': 'admin-secret' } })).toBe(true);
  });

  it('creates and validates an admin session cookie', async () => {
    const provider = new DatabaseAuthProvider(createMockUserStore(), 'admin-secret');
    const sessionId = await provider.admin.createSession!('admin-secret');
    expect(sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(await provider.admin.check({ cookies: { admin_session: sessionId! }, headers: {} })).toBe(true);
  });

  it('invalidates an admin session cookie', async () => {
    const provider = new DatabaseAuthProvider(createMockUserStore(), 'admin-secret');
    const sessionId = await provider.admin.createSession!('admin-secret');
    await provider.admin.invalidateSession!(sessionId!);
    expect(await provider.admin.check({ cookies: { admin_session: sessionId! }, headers: {} })).toBe(
      false,
    );
  });

  it('delegates user management operations to userStore', async () => {
    const userStore = createMockUserStore();
    userStore.createUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    userStore.loginUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    userStore.getUserByUsername.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    userStore.createToken.mockResolvedValue({ token: 'tok', id: 9 });
    userStore.listTokens.mockResolvedValue([
      { id: 9, org: 'team-a', description: null, createdAt: new Date(), expiresAt: null },
    ]);
    userStore.deleteToken.mockResolvedValue(true);

    const provider = new DatabaseAuthProvider(userStore, 'admin-secret');

    expect(await provider.userManagement!.createUser('alice', 'pass')).toEqual({
      id: 1,
      username: 'alice',
      createdAt: expect.any(Date),
    });
    expect(await provider.userManagement!.loginUser('alice', 'pass')).toEqual({
      id: 1,
      username: 'alice',
      createdAt: expect.any(Date),
    });
    expect(await provider.userManagement!.getUserByUsername('alice')).toEqual({
      id: 1,
      username: 'alice',
      createdAt: expect.any(Date),
    });
    expect(await provider.userManagement!.createToken(1, 'team-a', 'cli')).toEqual({ token: 'tok', id: 9 });
    expect(await provider.userManagement!.listTokens(1)).toHaveLength(1);
    expect(await provider.userManagement!.deleteToken(9, 1)).toBe(true);
  });
});

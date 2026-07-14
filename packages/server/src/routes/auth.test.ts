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
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { buildApp } from '../app.js';
import type { UserStore } from '../storage/user-store.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fully-stubbed, properly-typed mock of UserStore.
 * Each method is a no-op jest.fn() — configure per test with .mockResolvedValue().
 */
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

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-routes-'));
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  it('creates a user and returns 201 with id and username', async () => {
    const userStore = createMockUserStore();
    userStore.createUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.username).toBe('alice');
    expect(body.id).toBe(1);
  });

  it('returns 400 when username is too short', async () => {
    const app = await buildApp({ dataDir: tempDir, userStore: createMockUserStore() });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'a', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const app = await buildApp({ dataDir: tempDir, userStore: createMockUserStore() });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'short' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when username contains invalid characters', async () => {
    const app = await buildApp({ dataDir: tempDir, userStore: createMockUserStore() });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice smith', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when username is already taken', async () => {
    const userStore = createMockUserStore();
    userStore.createUser.mockRejectedValue(
      new Error('duplicate key value violates unique constraint'),
    );
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('rethrows unexpected registration errors', async () => {
    const userStore = createMockUserStore();
    userStore.createUser.mockRejectedValue(new Error('database unavailable'));
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  it('returns 403 when the user has no org memberships', async () => {
    const userStore = createMockUserStore();
    userStore.loginUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toMatch(/not a member of any org/i);
  });

  it('returns 401 for invalid credentials', async () => {
    const userStore = createMockUserStore();
    userStore.loginUser.mockResolvedValue(null);
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'wrongpass' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.payload).error).toBe('Invalid credentials');
  });

  it('returns 400 when username or password is missing', async () => {
    const app = await buildApp({ dataDir: tempDir, userStore: createMockUserStore() });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the requested org does not exist', async () => {
    const userStore = createMockUserStore();
    userStore.loginUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123', org: 'missing-org' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when the user is not a member of the requested org', async () => {
    const userStore = createMockUserStore();
    userStore.loginUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    const adminToken = 'admin-secret';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'acme' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123', org: 'acme' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns a token for a specific org when the user is a member', async () => {
    const userStore = createMockUserStore();
    userStore.loginUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    userStore.createToken.mockResolvedValue({ token: 'org-token', id: 11 });
    const adminToken = 'admin-secret';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'acme' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs/acme/members',
      headers: { 'x-admin-token': adminToken },
      payload: { userId: 'alice' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123', org: 'acme' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).org).toBe('acme');
  });

  it('returns 400 when the user belongs to multiple orgs without selecting one', async () => {
    const userStore = createMockUserStore();
    userStore.loginUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    const adminToken = 'admin-secret';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    for (const org of ['acme', 'widgets']) {
      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: org },
      });
      await app.inject({
        method: 'POST',
        url: `/api/admin/orgs/${org}/members`,
        headers: { 'x-admin-token': adminToken },
        payload: { userId: 'alice' },
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).orgs).toEqual(expect.arrayContaining(['acme', 'widgets']));
  });

  it('returns a token when the user belongs to exactly one org', async () => {
    const userStore = createMockUserStore();
    userStore.loginUser.mockResolvedValue({ id: 1, username: 'alice', createdAt: new Date() });
    userStore.createToken.mockResolvedValue({ token: 'rawtoken', id: 10 });

    const adminToken = 'admin-secret';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    // Seed org and member via admin API
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'acme' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs/acme/members',
      headers: { 'x-admin-token': adminToken },
      payload: { userId: 'alice' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.token).toBe('rawtoken');
    expect(body.org).toBe('acme');
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/tokens  (authenticated)
// ---------------------------------------------------------------------------
describe('GET /api/auth/tokens', () => {
  it('returns the user token list when authenticated', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    userStore.listTokens.mockResolvedValue([
      { id: 1, org: 'acme', description: 'login', createdAt: new Date(), expiresAt: null },
    ]);

    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.tokens).toHaveLength(1);
    expect(body.tokens[0].org).toBe('acme');
  });

  it('returns 401 without a bearer token', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: false,
      statusCode: 401,
      error: 'Unauthorized',
    });

    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/tokens',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/tokens  (create API token)
// ---------------------------------------------------------------------------
describe('POST /api/auth/tokens', () => {
  it('creates a token for an org the user belongs to', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    userStore.createToken.mockResolvedValue({ token: 'newtoken', id: 42 });

    const adminToken = 'test-admin-abc';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    // Seed org and member via admin API
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'acme' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs/acme/members',
      headers: { 'x-admin-token': adminToken },
      payload: { userId: 'alice' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
      payload: { org: 'acme', description: 'ci' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.token).toBe('newtoken');
    expect(body.tokenId).toBe(42);
    expect(body.org).toBe('acme');
  });

  it('returns 400 when org is missing from the request body', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
      payload: { description: 'ci' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the requested org does not exist', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
      payload: { org: 'missing-org' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for an invalid expiresAt value', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    const adminToken = 'test-admin-abc';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'acme' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs/acme/members',
      headers: { 'x-admin-token': adminToken },
      payload: { userId: 'alice' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
      payload: { org: 'acme', expiresAt: 'not-a-date' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when expiresAt is in the past', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    const adminToken = 'test-admin-abc';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'acme' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs/acme/members',
      headers: { 'x-admin-token': adminToken },
      payload: { userId: 'alice' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
      payload: { org: 'acme', expiresAt: '2000-01-01T00:00:00.000Z' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('accepts a future expiresAt value', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    userStore.createToken.mockResolvedValue({ token: 'future-token', id: 55 });
    const adminToken = 'test-admin-abc';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'acme' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs/acme/members',
      headers: { 'x-admin-token': adminToken },
      payload: { userId: 'alice' },
    });

    const future = new Date(Date.now() + 60_000).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
      payload: { org: 'acme', expiresAt: future },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.payload).expiresAt).toBe(future);
  });

  it('returns 403 when user is not a member of the requested org', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });

    const adminToken = 'test-admin-abc';
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken });

    // Create org but don't add alice
    await app.inject({
      method: 'POST',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
      payload: { name: 'other-org' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tokens',
      headers: { Authorization: 'Bearer sometoken' },
      payload: { org: 'other-org' },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/tokens/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/auth/tokens/:id', () => {
  it('revokes a token and returns success', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    userStore.deleteToken.mockResolvedValue(true);

    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/tokens/5',
      headers: { Authorization: 'Bearer sometoken' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).success).toBe(true);
  });

  it('returns 404 when token does not exist or belongs to another user', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });
    userStore.deleteToken.mockResolvedValue(false);

    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/tokens/99',
      headers: { Authorization: 'Bearer sometoken' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for a non-numeric token id', async () => {
    const userStore = createMockUserStore();
    userStore.resolveFromHeaders.mockResolvedValue({
      ok: true,
      publisher: { userId: 'alice', org: 'acme' },
    });
    userStore.resolveToken.mockResolvedValue({ userId: 1, username: 'alice', org: 'acme' });

    const app = await buildApp({ dataDir: tempDir, userStore });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/tokens/notanumber',
      headers: { Authorization: 'Bearer sometoken' },
    });

    expect(res.statusCode).toBe(400);
  });
});


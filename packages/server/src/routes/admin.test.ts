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
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { buildApp } from '../app.js';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

let testDir: string;
const adminToken = 'test-admin-token-123';

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), 'admin-routes-'));
});

afterEach(() => {
  rmSync(testDir, { recursive: true });
});

describe('/api/admin routes', () => {
  it('rejects requests without admin token', async () => {
    const app = await buildApp({ dataDir: testDir, adminToken });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orgs',
    });

    expect(res.statusCode).toBe(401);
  });

  it('accepts requests with valid admin token', async () => {
    const app = await buildApp({ dataDir: testDir, adminToken });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': adminToken },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects requests with invalid admin token', async () => {
    const app = await buildApp({ dataDir: testDir, adminToken });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orgs',
      headers: { 'x-admin-token': 'wrong-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  describe('POST /api/admin/orgs', () => {
    it('creates a new org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('acme');
      expect(body.members).toContain('admin');
    });

    it('returns 400 when name is missing', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects duplicate org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      expect(res.statusCode).toBe(409);
    });

    it('stores metadata when provided', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme', metadata: { tier: 'premium' } },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.metadata).toEqual({ tier: 'premium' });
    });
  });

  describe('GET /api/admin/orgs', () => {
    it('returns empty list initially', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.orgs).toEqual([]);
    });

    it('returns all orgs', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'widgets' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.orgs).toHaveLength(2);
      expect(body.orgs.map((o: any) => o.name)).toEqual(['acme', 'widgets']);
    });
  });

  describe('GET /api/admin/orgs/:name', () => {
    it('returns a single org by name', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/orgs/acme',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).name).toBe('acme');
    });

    it('returns 404 for a missing org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/orgs/missing',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/admin/orgs/:name/members', () => {
    it('adds member to org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orgs/acme/members',
        headers: { 'x-admin-token': adminToken },
        payload: { userId: 'alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.members).toContain('alice');
    });

    it('returns 400 when userId is missing', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orgs/acme/members',
        headers: { 'x-admin-token': adminToken },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for nonexistent org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/orgs/nonexistent/members',
        headers: { 'x-admin-token': adminToken },
        payload: { userId: 'alice' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/admin/tokens', () => {
    it('returns 400 when org or userId is missing', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tokens',
        headers: { 'x-admin-token': adminToken },
        payload: { org: 'acme' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when the org does not exist', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tokens',
        headers: { 'x-admin-token': adminToken },
        payload: { org: 'missing', userId: 'alice' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('generates token for org member', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tokens',
        headers: { 'x-admin-token': adminToken },
        payload: { org: 'acme', userId: 'admin' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBeDefined();
      expect(body.token.length).toBeGreaterThan(0);
      expect(body.envEntry).toContain('=');
    });

    it('rejects token for non-member', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tokens',
        headers: { 'x-admin-token': adminToken },
        payload: { org: 'acme', userId: 'alice' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/admin/orgs/:name', () => {
    it('deletes an org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/orgs/acme',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(200);

      // Verify it's gone
      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
      });

      const body = JSON.parse(checkRes.body);
      expect(body.orgs).toHaveLength(0);
    });

    it('returns 404 for nonexistent org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/orgs/nonexistent',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/admin/audit-log', () => {
    it('returns audit log entries', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-log',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].action).toBe('create_org');
    });

    it('filters audit log by org', async () => {
      const app = await buildApp({ dataDir: testDir, adminToken });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'acme' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/admin/orgs',
        headers: { 'x-admin-token': adminToken },
        payload: { name: 'widgets' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-log?org=acme',
        headers: { 'x-admin-token': adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].orgName).toBe('acme');
    });
  });
  it('accepts admin session cookies for API access', async () => {
    const app = await buildApp({ dataDir: testDir, adminToken });
    const login = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { token: adminToken },
    });
    const cookie = login.cookies.find((c) => c.name === 'admin_session');
    expect(cookie).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orgs',
      headers: { cookie: `admin_session=${cookie!.value}` },
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('/portal/admin route', () => {
  it('redirects unauthenticated GET /portal/admin to login when admin token is configured', async () => {
    const app = await buildApp({ dataDir: testDir, adminToken });

    const res = await app.inject({
      method: 'GET',
      url: '/admin',
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBe('/admin/login');
    await app.close();
  });

  it('does not serve admin portal when admin token is not configured', async () => {
    const app = await buildApp({ dataDir: testDir });

    const res = await app.inject({
      method: 'GET',
      url: '/admin',
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

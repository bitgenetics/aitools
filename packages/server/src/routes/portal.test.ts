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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../app.js';

describe('Portal routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tmp: string;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-portal-'));
    app = await buildApp({ dataDir: tmp, logger: false });
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmp, { recursive: true });
  });

  it('serves the portal HTML at /portal', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('AITools Registry');
  });

  it('serves skill details page HTML at /portal/skills/:name', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills/sample-skill' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Skill Details - sample-skill');
    expect(res.body).toContain('Back to Portal');
  });

  describe('Admin login portal (when ADMIN_TOKEN is configured)', () => {
    let adminApp: Awaited<ReturnType<typeof buildApp>>;
    let adminTmp: string;
    const ADMIN_TOKEN = 'super-secret-token';

    beforeEach(async () => {
      adminTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-admin-'));
      adminApp = await buildApp({ dataDir: adminTmp, logger: false, adminToken: ADMIN_TOKEN });
    });

    afterEach(async () => {
      await adminApp.close();
      fs.rmSync(adminTmp, { recursive: true });
    });

    it('serves the login page at GET /portal/admin/login', async () => {
      const res = await adminApp.inject({ method: 'GET', url: '/admin/login' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('Admin Login');
    });

    it('redirects unauthenticated GET /portal/admin to login', async () => {
      const res = await adminApp.inject({ method: 'GET', url: '/admin' });
      expect(res.statusCode).toBe(302);
      expect(res.headers['location']).toBe('/admin/login');
    });

    it('returns 400 / redirect on POST /portal/admin/login with wrong token', async () => {
      const res = await adminApp.inject({
        method: 'POST',
        url: '/admin/login',
        payload: 'token=wrong-token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      expect(res.statusCode).toBe(200); // re-renders login page
      expect(res.body).toContain('Invalid token');
    });

    it('sets session cookie and redirects on POST /portal/admin/login with correct token', async () => {
      const res = await adminApp.inject({
        method: 'POST',
        url: '/admin/login',
        payload: `token=${ADMIN_TOKEN}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      expect(res.statusCode).toBe(302);
      expect(res.headers['location']).toBe('/admin');
      expect(res.headers['set-cookie']).toMatch(/admin_session=/);
    });

    it('serves admin dashboard at GET /portal/admin with valid session cookie', async () => {
      // First: login to get a session cookie
      const loginRes = await adminApp.inject({
        method: 'POST',
        url: '/admin/login',
        payload: `token=${ADMIN_TOKEN}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      const cookieHeader = loginRes.headers['set-cookie'] as string;
      const sessionCookie = cookieHeader.split(';')[0]!; // e.g. "admin_session=abc123"

      const res = await adminApp.inject({
        method: 'GET',
        url: '/admin',
        headers: { cookie: sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('Admin Panel');
    });

    it('clears session and redirects on GET /portal/admin/logout', async () => {
      // Login first
      const loginRes = await adminApp.inject({
        method: 'POST',
        url: '/admin/login',
        payload: `token=${ADMIN_TOKEN}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      const cookieHeader = loginRes.headers['set-cookie'] as string;
      const sessionCookie = cookieHeader.split(';')[0]!;

      const logoutRes = await adminApp.inject({
        method: 'GET',
        url: '/admin/logout',
        headers: { cookie: sessionCookie },
      });
      expect(logoutRes.statusCode).toBe(302);
      expect(logoutRes.headers['location']).toBe('/admin/login');

      // Session should be invalid now — dashboard should redirect
      const dashboardRes = await adminApp.inject({
        method: 'GET',
        url: '/admin',
        headers: { cookie: sessionCookie },
      });
      expect(dashboardRes.statusCode).toBe(302);
      expect(dashboardRes.headers['location']).toBe('/admin/login');
    });
  });
});
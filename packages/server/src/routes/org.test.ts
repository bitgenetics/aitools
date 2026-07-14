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
import { describe, it, expect, beforeEach } from '@jest/globals';
import { buildApp } from '../app.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Org Routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-'));
    const authConfig = {
      tokens: {
        'token-alice': { userId: 'alice', orgs: ['acme'] },
        'token-bob': { userId: 'bob', orgs: ['acme', 'widgetcorp'] },
      },
    };

    app = await buildApp({
      dataDir: tempDir,
      publisherAuthConfig: authConfig,
    });

    // Publish a test tool to acme org
    const manifestBlob = {
      name: 'test-tool',
      version: '1.0.0',
      description: 'Test tool',
      category: 'skill',
      files: [{ src: 'SKILL.md', dest: 'test-tool/SKILL.md' }],
    };
    const filesBlob = { 'SKILL.md': '# Test' };

    const response = await app.inject({
      method: 'POST',
      url: '/api/tools',
      headers: { Authorization: 'Bearer token-alice', 'x-aitools-org': 'acme' },
      payload: { manifest: manifestBlob, files: filesBlob },
    });
    expect(response.statusCode).toBe(201);
  });

  it('GET /api/org/info returns org details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/org/info',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.userId).toBe('alice');
    expect(body.org).toBe('acme');
    expect(body.memberOrgs).toContain('acme');
  });

  it('GET /api/org/info returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/org/info',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/org/tools lists org tools', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/org/tools',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.org).toBe('acme');
    expect(body.toolCount).toBeGreaterThan(0);
    expect(body.tools).toBeInstanceOf(Array);
    expect(body.tools[0].name).toBe('test-tool');
  });

  it('GET /api/org/members lists org members', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/org/members',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.org).toBe('acme');
    expect(body.members).toBeInstanceOf(Array);
    // members list is managed via OrgStore; in simple-auth mode it returns []
  });

  it('POST /api/org/tools/:name/deprecate marks version deprecated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/test-tool/deprecate?version=1.0.0',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('POST /api/org/tools/:name/unpublish removes specific version', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/test-tool/unpublish?version=1.0.0',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('POST /api/org/tools/:name/unpublish forbidden for different org', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/test-tool/unpublish?version=1.0.0',
      headers: { Authorization: 'Bearer token-bob', 'x-aitools-org': 'widgetcorp' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/org/tools/:name/deprecate returns 400 when version is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/test-tool/deprecate',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toMatch(/version query param required/i);
  });

  it('POST /api/org/tools/:name/deprecate returns 404 for an unknown tool', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/missing-tool/deprecate?version=1.0.0',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/org/tools/:name/deprecate returns 403 for a different org', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/test-tool/deprecate?version=1.0.0',
      headers: { Authorization: 'Bearer token-bob', 'x-aitools-org': 'widgetcorp' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/org/tools/:name/deprecate returns 500 when the version does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/test-tool/deprecate?version=9.9.9',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.payload).error).toMatch(/Failed to deprecate/i);
  });

  it('POST /api/org/tools/:name/unpublish returns 404 for an unknown tool', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/missing-tool/unpublish?version=1.0.0',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/org/tools/:name/unpublish removes all versions when version is omitted', async () => {
    const publish = async (version: string) => {
      await app.inject({
        method: 'POST',
        url: '/api/tools',
        headers: { Authorization: 'Bearer token-alice', 'x-aitools-org': 'acme' },
        payload: {
          manifest: {
            name: 'multi-version-tool',
            version,
            description: `Version ${version}`,
            category: 'skill',
            files: [{ src: 'SKILL.md', dest: 'multi-version-tool/SKILL.md' }],
          },
          files: { 'SKILL.md': `# v${version}` },
        },
      });
    };
    await publish('1.0.0');
    await publish('2.0.0');

    const res = await app.inject({
      method: 'POST',
      url: '/api/org/tools/multi-version-tool/unpublish',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.removedVersions).toEqual(expect.arrayContaining(['1.0.0', '2.0.0']));
  });

  it('GET /api/org/tools omits tools owned by other orgs', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/tools',
      headers: { Authorization: 'Bearer token-bob', 'x-aitools-org': 'widgetcorp' },
      payload: {
        manifest: {
          name: 'widget-tool',
          version: '1.0.0',
          description: 'Widget only',
          category: 'skill',
          files: [{ src: 'SKILL.md', dest: 'widget-tool/SKILL.md' }],
        },
        files: { 'SKILL.md': '# Widget' },
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/org/tools',
      headers: { Authorization: 'Bearer token-alice' },
    });
    expect(res.statusCode).toBe(200);
    const names = (JSON.parse(res.payload).tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('test-tool');
    expect(names).not.toContain('widget-tool');
  });
});

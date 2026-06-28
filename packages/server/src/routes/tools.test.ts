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
import type { ToolManifest } from '@bitgenetics/aitools-core';

const VALID_MANIFEST: ToolManifest = {
  name: 'test-skill',
  version: '1.0.0',
  description: 'Test skill for unit tests',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'skills/skill.md' }],
};

const VALID_FILES = { 'skill.md': '# Test Skill' };

async function publish(
  app: Awaited<ReturnType<typeof buildApp>>,
  manifest = VALID_MANIFEST,
  files = VALID_FILES,
) {
  return app.inject({ method: 'POST', url: '/api/tools', payload: { manifest, files } });
}

describe('Tool HTTP routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tmp: string;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-server-'));
    app = await buildApp({ dataDir: tmp, logger: false });
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmp, { recursive: true });
  });

  // -- GET /tools -------------------------------------------------------------

  describe('GET /tools', () => {
    it('returns an empty array when no tools are published', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tools' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns all published tools after publishing', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/api/tools' });
      expect(res.json()).toHaveLength(1);
    });
  });

  // -- POST /tools ------------------------------------------------------------

  describe('POST /tools', () => {
    it('returns 201 with an integrity hash on success', async () => {
      const res = await publish(app);
      expect(res.statusCode).toBe(201);
      expect(res.json().integrity).toMatch(/^sha256-/);
    });

    it('returns 400 when the manifest fails validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools',
        payload: { manifest: { name: '' }, files: {} },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when a file listed in the manifest is absent from the files map', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools',
        payload: { manifest: VALID_MANIFEST, files: {} },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 409 when the same version is published a second time', async () => {
      await publish(app);
      const res = await publish(app);
      expect(res.statusCode).toBe(409);
    });
  });

  // -- GET /tools/:name -------------------------------------------------------

  describe('GET /tools/:name', () => {
    it('returns 404 for an unknown tool', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tools/ghost' });
      expect(res.statusCode).toBe(404);
    });

    it('returns the latest manifest after publishing', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/api/tools/test-skill' });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('test-skill');
    });
  });

  // -- GET /tools/:name/:version ----------------------------------------------

  describe('GET /tools/:name/:version', () => {
    beforeEach(() => publish(app));

    it('returns the manifest for a specific version', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tools/test-skill/1.0.0' });
      expect(res.statusCode).toBe(200);
      expect(res.json().version).toBe('1.0.0');
    });

    it('returns 404 for a non-existent version', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tools/test-skill/9.9.9' });
      expect(res.statusCode).toBe(404);
    });

    it('returns the version list when "versions" is used as the version segment', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tools/test-skill/versions' });
      expect(res.statusCode).toBe(200);
      expect(res.json().versions).toContain('1.0.0');
    });
  });

  // -- GET /tools/:name/:version/tarball --------------------------------------

  describe('GET /tools/:name/:version/tarball', () => {
    it('returns the tarball as a JSON array of file entries', async () => {
      await publish(app);
      const res = await app.inject({
        method: 'GET',
        url: '/api/tools/test-skill/1.0.0/tarball',
      });
      expect(res.statusCode).toBe(200);
      const entries = JSON.parse(res.body) as Array<{ path: string }>;
      expect(entries[0]?.path).toBe('skill.md');
    });

    it('returns 404 for an unknown tool', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tools/ghost/1.0.0/tarball',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -- GET /search ------------------------------------------------------------

  describe('GET /search', () => {
    it('returns tools matching the query', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/api/search?q=test-skill' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it('returns an empty array when nothing matches', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/api/search?q=zzz-no-match' });
      expect(res.json()).toHaveLength(0);
    });

    it('returns all tools for an empty query', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/api/search?q=' });
      expect(res.json()).toHaveLength(1);
    });
  });

  // -- GET /health ------------------------------------------------------------

  describe('GET /health', () => {
    it('returns status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });
  });
});



describe('POST /tools � publishToken enforcement', () => {
  let tmp2: string;
  let authApp: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-auth-'));
    authApp = await buildApp({ dataDir: tmp2, logger: false, publishToken: 'secret-tok' });
  });

  afterEach(async () => {
    await authApp.close();
    fs.rmSync(tmp2, { recursive: true });
  });

  it('returns 401 when no Authorization header is supplied', async () => {
    const res = await authApp.inject({
      method: 'POST',
      url: '/api/tools',
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when the token is wrong', async () => {
    const res = await authApp.inject({
      method: 'POST',
      url: '/api/tools',
      headers: { authorization: 'Bearer wrong-token' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a correct bearer token and returns 201', async () => {
    const res = await authApp.inject({
      method: 'POST',
      url: '/api/tools',
      headers: { authorization: 'Bearer secret-tok' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('POST /tools � org-aware publisher auth', () => {
  let tmp4: string;
  let orgAuthApp: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-orgauth-'));
    orgAuthApp = await buildApp({
      dataDir: tmp4,
      logger: false,
      publisherAuthConfig: {
        tokens: {
          tokenA: { userId: 'alice', orgs: ['acme'] },
          tokenB: { userId: 'bob', orgs: ['acme', 'shared'] },
          tokenC: { userId: 'mallory', orgs: ['other'] },
        },
      },
    });
  });

  afterEach(async () => {
    await orgAuthApp.close();
    fs.rmSync(tmp4, { recursive: true });
  });

  it('returns 401 when no bearer token is provided', async () => {
    const res = await orgAuthApp.inject({
      method: 'POST',
      url: '/api/tools',
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when a multi-org user does not specify x-aitools-org', async () => {
    const res = await orgAuthApp.inject({
      method: 'POST',
      url: '/api/tools',
      headers: { authorization: 'Bearer tokenB' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows first publish and subsequent publish from the owner org', async () => {
    const first = await orgAuthApp.inject({
      method: 'POST',
      url: '/api/tools',
      headers: { authorization: 'Bearer tokenA' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
    expect(first.statusCode).toBe(201);

    const second = await orgAuthApp.inject({
      method: 'POST',
      url: '/api/tools',
      headers: {
        authorization: 'Bearer tokenB',
        'x-aitools-org': 'acme',
      },
      payload: {
        manifest: { ...VALID_MANIFEST, version: '1.0.1' },
        files: VALID_FILES,
      },
    });
    expect(second.statusCode).toBe(201);
  });

  it('rejects publish from non-owner org user', async () => {
    await orgAuthApp.inject({
      method: 'POST',
      url: '/api/tools',
      headers: { authorization: 'Bearer tokenA' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });

    const forbidden = await orgAuthApp.inject({
      method: 'POST',
      url: '/api/tools',
      headers: {
        authorization: 'Bearer tokenC',
        'x-aitools-org': 'other',
      },
      payload: {
        manifest: { ...VALID_MANIFEST, version: '1.0.2' },
        files: VALID_FILES,
      },
    });

    expect(forbidden.statusCode).toBe(403);
  });
});

describe('buildApp � upstream URL validation', () => {
  let tmp3: string;

  beforeEach(() => {
    tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-urlval-'));
  });

  afterEach(() => {
    fs.rmSync(tmp3, { recursive: true });
  });

  it('throws for a non-http/https upstream URL', async () => {
    await expect(
      buildApp({
        dataDir: tmp3,
        logger: false,
        upstreams: [{ name: 'bad', url: 'ftp://evil.example.com' }],
      }),
    ).rejects.toThrow('http or https');
  });

  it('throws for a malformed upstream URL', async () => {
    await expect(
      buildApp({
        dataDir: tmp3,
        logger: false,
        upstreams: [{ name: 'bad', url: 'not a url at all' }],
      }),
    ).rejects.toThrow(/invalid upstream url/i);
  });

  it('accepts valid http upstream URLs', async () => {
    const validApp = await buildApp({
      dataDir: tmp3,
      logger: false,
      upstreams: [{ name: 'ok', url: 'http://registry.example.com' }],
    });
    await validApp.close();
  });
});

// -- registryAccess ----------------------------------------------------------

const PRIVATE_MANIFEST: ToolManifest = {
  ...VALID_MANIFEST,
  name: 'private-skill',
  private: true,
};

describe('registryAccess=private (default)', () => {
  let tmp: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-priv-'));
    app = await buildApp({ dataDir: tmp, logger: false, publishToken: 'tok', registryAccess: 'private' });
    await app.inject({
      method: 'POST', url: '/api/tools',
      headers: { authorization: 'Bearer tok' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns 401 on GET /tools without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tools' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 on GET /search without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 on GET /tools/:name without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tools/test-skill' });
    expect(res.statusCode).toBe(401);
  });

  it('returns tools when a valid token is supplied', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/tools',
      headers: { authorization: 'Bearer tok' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

describe('registryAccess=public', () => {
  let tmp: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-pub-'));
    app = await buildApp({ dataDir: tmp, logger: false, publishToken: 'tok', registryAccess: 'public' });
    // Publish one public and one private tool
    await app.inject({
      method: 'POST', url: '/api/tools',
      headers: { authorization: 'Bearer tok' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
    await app.inject({
      method: 'POST', url: '/api/tools',
      headers: { authorization: 'Bearer tok' },
      payload: { manifest: PRIVATE_MANIFEST, files: VALID_FILES },
    });
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmp, { recursive: true });
  });

  it('lists only non-private tools without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tools' });
    expect(res.statusCode).toBe(200);
    const names = (res.json() as Array<{ name: string }>).map((m) => m.name);
    expect(names).toContain('test-skill');
    expect(names).not.toContain('private-skill');
  });

  it('returns 404 for a private tool when accessed without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tools/private-skill' });
    expect(res.statusCode).toBe(404);
  });

  it('hides private tools from search results without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=skill' });
    expect(res.statusCode).toBe(200);
    const names = (res.json() as Array<{ name: string }>).map((m) => m.name);
    expect(names).not.toContain('private-skill');
  });

  it('shows private tools to authenticated callers', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/tools',
      headers: { authorization: 'Bearer tok' },
    });
    expect(res.statusCode).toBe(200);
    const names = (res.json() as Array<{ name: string }>).map((m) => m.name);
    expect(names).toContain('private-skill');
  });
});

// -- PATCH /tools/:name � owner privacy control ------------------------------

describe('PATCH /tools/:name', () => {
  let tmp: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-patch-'));
    app = await buildApp({
      dataDir: tmp,
      logger: false,
      registryAccess: 'public',
      publisherAuthConfig: {
        tokens: {
          'owner-tok': { userId: 'alice', orgs: ['acme'] },
          'other-tok': { userId: 'mallory', orgs: ['rival'] },
        },
      },
    });
    // Publish the tool as acme
    await app.inject({
      method: 'POST', url: '/api/tools',
      headers: { authorization: 'Bearer owner-tok' },
      payload: { manifest: VALID_MANIFEST, files: VALID_FILES },
    });
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns 401 when no auth is provided', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/tools/test-skill',
      payload: { private: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for an invalid body', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/tools/test-skill',
      headers: { authorization: 'Bearer owner-tok' },
      payload: { private: 'yes' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when a different org tries to change privacy', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/tools/test-skill',
      headers: { authorization: 'Bearer other-tok' },
      payload: { private: true },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 404 for an unknown tool', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/tools/ghost',
      headers: { authorization: 'Bearer owner-tok' },
      payload: { private: true },
    });
    expect(res.statusCode).toBe(404);
  });

  it('sets private=true and hides the tool from public reads', async () => {
    const patch = await app.inject({
      method: 'PATCH', url: '/api/tools/test-skill',
      headers: { authorization: 'Bearer owner-tok' },
      payload: { private: true },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({ name: 'test-skill', private: true });

    // Unauthenticated read should now get 404
    const get = await app.inject({ method: 'GET', url: '/api/tools/test-skill' });
    expect(get.statusCode).toBe(404);
  });

  it('sets private=false to restore public visibility', async () => {
    // Make private first
    await app.inject({
      method: 'PATCH', url: '/api/tools/test-skill',
      headers: { authorization: 'Bearer owner-tok' },
      payload: { private: true },
    });
    // Make public again
    await app.inject({
      method: 'PATCH', url: '/api/tools/test-skill',
      headers: { authorization: 'Bearer owner-tok' },
      payload: { private: false },
    });

    const get = await app.inject({ method: 'GET', url: '/api/tools/test-skill' });
    expect(get.statusCode).toBe(200);
  });
});

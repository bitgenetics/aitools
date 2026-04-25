import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../app.js';
import type { ToolManifest } from '@ai-tools/core';

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
  return app.inject({ method: 'POST', url: '/tools', payload: { manifest, files } });
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

  // ── GET /tools ─────────────────────────────────────────────────────────────

  describe('GET /tools', () => {
    it('returns an empty array when no tools are published', async () => {
      const res = await app.inject({ method: 'GET', url: '/tools' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns all published tools after publishing', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/tools' });
      expect(res.json()).toHaveLength(1);
    });
  });

  // ── POST /tools ────────────────────────────────────────────────────────────

  describe('POST /tools', () => {
    it('returns 201 with an integrity hash on success', async () => {
      const res = await publish(app);
      expect(res.statusCode).toBe(201);
      expect(res.json().integrity).toMatch(/^sha256-/);
    });

    it('returns 400 when the manifest fails validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tools',
        payload: { manifest: { name: '' }, files: {} },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when a file listed in the manifest is absent from the files map', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tools',
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

  // ── GET /tools/:name ───────────────────────────────────────────────────────

  describe('GET /tools/:name', () => {
    it('returns 404 for an unknown tool', async () => {
      const res = await app.inject({ method: 'GET', url: '/tools/ghost' });
      expect(res.statusCode).toBe(404);
    });

    it('returns the latest manifest after publishing', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/tools/test-skill' });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('test-skill');
    });
  });

  // ── GET /tools/:name/:version ──────────────────────────────────────────────

  describe('GET /tools/:name/:version', () => {
    beforeEach(() => publish(app));

    it('returns the manifest for a specific version', async () => {
      const res = await app.inject({ method: 'GET', url: '/tools/test-skill/1.0.0' });
      expect(res.statusCode).toBe(200);
      expect(res.json().version).toBe('1.0.0');
    });

    it('returns 404 for a non-existent version', async () => {
      const res = await app.inject({ method: 'GET', url: '/tools/test-skill/9.9.9' });
      expect(res.statusCode).toBe(404);
    });

    it('returns the version list when "versions" is used as the version segment', async () => {
      const res = await app.inject({ method: 'GET', url: '/tools/test-skill/versions' });
      expect(res.statusCode).toBe(200);
      expect(res.json().versions).toContain('1.0.0');
    });
  });

  // ── GET /tools/:name/:version/tarball ──────────────────────────────────────

  describe('GET /tools/:name/:version/tarball', () => {
    it('returns the tarball as a JSON array of file entries', async () => {
      await publish(app);
      const res = await app.inject({
        method: 'GET',
        url: '/tools/test-skill/1.0.0/tarball',
      });
      expect(res.statusCode).toBe(200);
      const entries = JSON.parse(res.body) as Array<{ path: string }>;
      expect(entries[0]?.path).toBe('skill.md');
    });

    it('returns 404 for an unknown tool', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/tools/ghost/1.0.0/tarball',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /search ────────────────────────────────────────────────────────────

  describe('GET /search', () => {
    it('returns tools matching the query', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/search?q=test-skill' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it('returns an empty array when nothing matches', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/search?q=zzz-no-match' });
      expect(res.json()).toHaveLength(0);
    });

    it('returns all tools for an empty query', async () => {
      await publish(app);
      const res = await app.inject({ method: 'GET', url: '/search?q=' });
      expect(res.json()).toHaveLength(1);
    });
  });

  // ── GET /health ────────────────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
    });
  });
});


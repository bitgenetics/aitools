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
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../app.js';

// ── Shared upstream test server ─────────────────────────────────────────────

let upstreamServer: http.Server;
let upstreamUrl: string;
// Mutable so individual tests can control upstream responses.
let upstreamSearchPayload: unknown[] = [];

beforeAll(async () => {
  upstreamServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(upstreamSearchPayload));
  });
  await new Promise<void>((resolve) => upstreamServer.listen(0, '127.0.0.1', resolve));
  const addr = upstreamServer.address() as { port: number };
  upstreamUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      upstreamServer.close((err) => (err ? reject(err) : resolve())),
    ),
);

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Registry proxy routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tmp: string;

  beforeEach(async () => {
    upstreamSearchPayload = [];
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-registry-'));
    app = await buildApp({
      dataDir: tmp,
      logger: false,
      upstreams: [{ name: 'test-upstream', url: upstreamUrl }],
    });
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmp, { recursive: true });
  });

  // ── GET /api/upstream ──────────────────────────────────────────────────────────

  describe('GET /api/upstream', () => {
    it('returns the list of configured upstreams', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/upstream' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([{ name: 'test-upstream', url: upstreamUrl }]);
    });

    it('returns an empty array when no upstreams are configured', async () => {
      const noUpstreamTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-nu-'));
      const noUpstreamApp = await buildApp({ dataDir: noUpstreamTmp, logger: false });
      try {
        const res = await noUpstreamApp.inject({ method: 'GET', url: '/api/upstream' });
        expect(res.json()).toEqual([]);
      } finally {
        await noUpstreamApp.close();
        fs.rmSync(noUpstreamTmp, { recursive: true });
      }
    });
  });

  // ── GET /proxy/search ──────────────────────────────────────────────────────

  describe('GET /proxy/search', () => {
    it('returns results forwarded from the upstream', async () => {
      upstreamSearchPayload = [
        { name: 'upstream-skill', version: '1.0.0', description: 'A skill from upstream' },
      ];

      const res = await app.inject({ method: 'GET', url: '/proxy/search?q=skill' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect((res.json() as Array<{ name: string }>)[0]?.name).toBe('upstream-skill');
    });

    it('returns an empty array when the upstream returns no matches', async () => {
      upstreamSearchPayload = [];

      const res = await app.inject({ method: 'GET', url: '/proxy/search?q=nothing' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('merges results from multiple upstreams', async () => {
      upstreamSearchPayload = [{ name: 'skill-a', version: '1.0.0', description: 'A' }];

      // Build a second upstream server that returns a different result
      const secondServer = http.createServer((_req, res2) => {
        res2.writeHead(200, { 'Content-Type': 'application/json' });
        res2.end(JSON.stringify([{ name: 'skill-b', version: '1.0.0', description: 'B' }]));
      });
      await new Promise<void>((resolve) => secondServer.listen(0, '127.0.0.1', resolve));
      const secondAddr = secondServer.address() as { port: number };
      const secondUrl = `http://127.0.0.1:${secondAddr.port}`;

      const twoUpstreamTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-2up-'));
      const twoUpstreamApp = await buildApp({
        dataDir: twoUpstreamTmp,
        logger: false,
        upstreams: [
          { name: 'first', url: upstreamUrl },
          { name: 'second', url: secondUrl },
        ],
      });

      try {
        const res = await twoUpstreamApp.inject({ method: 'GET', url: '/proxy/search?q=' });
        const names = (res.json() as Array<{ name: string }>).map((r) => r.name);
        expect(names).toContain('skill-a');
        expect(names).toContain('skill-b');
      } finally {
        await twoUpstreamApp.close();
        fs.rmSync(twoUpstreamTmp, { recursive: true });
        await new Promise<void>((resolve) => secondServer.close(() => resolve()));
      }
    });

    it('returns partial results when one upstream is unreachable', async () => {
      upstreamSearchPayload = [{ name: 'good-result', version: '1.0.0', description: 'OK' }];

      const faultyTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-faulty-'));
      const faultyApp = await buildApp({
        dataDir: faultyTmp,
        logger: false,
        upstreams: [
          { name: 'working', url: upstreamUrl },
          { name: 'broken', url: 'http://127.0.0.1:1' }, // unreachable port
        ],
      });

      try {
        const res = await faultyApp.inject({ method: 'GET', url: '/proxy/search?q=test' });
        expect(res.statusCode).toBe(200);
        expect((res.json() as Array<{ name: string }>)[0]?.name).toBe('good-result');
      } finally {
        await faultyApp.close();
        fs.rmSync(faultyTmp, { recursive: true });
      }
    });
  });

  // ── GET /health ────────────────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns status ok with the upstream count', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('ok');
      expect(res.json().upstreams).toBe(1);
    });
  });
});

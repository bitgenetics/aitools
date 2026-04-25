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
import { createRegistryClient } from './registry-client.js';
import type { ToolManifest } from '@ai-tools/core';

// ---------------------------------------------------------------------------
// Minimal local HTTP server used across all tests
// ---------------------------------------------------------------------------

interface FakeServer {
  url: string;
  setResponse(statusCode: number, body: unknown): void;
  setRawResponse(statusCode: number, buf: Buffer, contentType?: string): void;
  lastRequest(): { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: string } | null;
  close(): Promise<void>;
}

async function createFakeServer(): Promise<FakeServer> {
  let nextStatus = 200;
  let nextBody: Buffer = Buffer.from('{}');
  let nextContentType = 'application/json';
  let lastReq: ReturnType<FakeServer['lastRequest']> = null;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      lastReq = {
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      res.writeHead(nextStatus, { 'Content-Type': nextContentType });
      res.end(nextBody);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };

  return {
    url: `http://127.0.0.1:${addr.port}`,
    setResponse(statusCode: number, body: unknown) {
      nextStatus = statusCode;
      nextBody = Buffer.from(JSON.stringify(body), 'utf8');
      nextContentType = 'application/json';
    },
    setRawResponse(statusCode: number, buf: Buffer, contentType = 'application/octet-stream') {
      nextStatus = statusCode;
      nextBody = buf;
      nextContentType = contentType;
    },
    lastRequest: () => lastReq,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())),
  };
}

const MANIFEST: ToolManifest = {
  name: 'my-skill',
  version: '1.0.0',
  description: 'A test skill',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'skill.md' }],
};

// ---------------------------------------------------------------------------

describe('createRegistryClient', () => {
  let server: FakeServer;

  beforeAll(async () => {
    server = await createFakeServer();
  });

  afterAll(() => server.close());

  function client(auth?: { type: 'bearer'; token: string } | { type: 'basic'; username: string; password: string }) {
    return createRegistryClient({ name: 'test', url: server.url, auth });
  }

  // ── getManifest ────────────────────────────────────────────────────────────

  describe('getManifest()', () => {
    it('returns parsed manifest on 200', async () => {
      server.setResponse(200, MANIFEST);
      const result = await client().getManifest('my-skill', '1.0.0');
      expect(result.name).toBe('my-skill');
      expect(result.version).toBe('1.0.0');
    });

    it('requests /tools/<encoded-name>/latest by default', async () => {
      server.setResponse(200, MANIFEST);
      await client().getManifest('my-skill');
      expect(server.lastRequest()?.url).toBe('/api/tools/my-skill/latest');
    });

    it('encodes scoped package names in the URL', async () => {
      server.setResponse(200, MANIFEST);
      await client().getManifest('@scope/my-skill', '1.0.0');
      expect(server.lastRequest()?.url).toContain('%40scope%2Fmy-skill');
    });

    it('throws on 404', async () => {
      server.setResponse(404, { error: 'Not found' });
      await expect(client().getManifest('ghost', '1.0.0')).rejects.toThrow('HTTP 404');
    });

    it('throws on 401', async () => {
      server.setResponse(401, { error: 'Unauthorized' });
      await expect(client().getManifest('secret', '1.0.0')).rejects.toThrow('authentication required');
    });

    it('throws on 403', async () => {
      server.setResponse(403, { error: 'Forbidden' });
      await expect(client().getManifest('secret', '1.0.0')).rejects.toThrow('authentication required');
    });
  });

  // ── listVersions ───────────────────────────────────────────────────────────

  describe('listVersions()', () => {
    it('returns the versions array from the registry response', async () => {
      server.setResponse(200, { name: 'my-skill', versions: ['1.0.0', '1.1.0', '2.0.0'] });
      const versions = await client().listVersions('my-skill');
      expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    it('requests /tools/<name>/versions', async () => {
      server.setResponse(200, { name: 'my-skill', versions: [] });
      await client().listVersions('my-skill');
      expect(server.lastRequest()?.url).toBe('/api/tools/my-skill/versions');
    });

    it('throws on non-200 status', async () => {
      server.setResponse(404, { error: 'Not found' });
      await expect(client().listVersions('ghost')).rejects.toThrow('HTTP 404');
    });
  });

  // ── search ─────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('returns results with the registry URL attached', async () => {
      server.setResponse(200, [
        { name: 'my-skill', version: '1.0.0', description: 'A skill', category: 'skill' },
      ]);
      const results = await client().search('skill');
      expect(results).toHaveLength(1);
      expect(results[0]?.registry).toBe(server.url);
    });

    it('URL-encodes the query string', async () => {
      server.setResponse(200, []);
      await client().search('my skill query');
      expect(server.lastRequest()?.url).toBe('/api/search?q=my%20skill%20query');
    });

    it('returns empty array when registry returns none', async () => {
      server.setResponse(200, []);
      const results = await client().search('no-match');
      expect(results).toHaveLength(0);
    });

    it('throws on 500', async () => {
      server.setResponse(500, { error: 'Server error' });
      await expect(client().search('query')).rejects.toThrow('HTTP 500');
    });
  });

  // ── download ───────────────────────────────────────────────────────────────

  describe('download()', () => {
    it('returns the response body as a Buffer with integrity', async () => {
      const payload = Buffer.from('tarball-bytes', 'utf8');
      server.setRawResponse(200, payload, 'application/octet-stream');
      const result = await client().download('my-skill', '1.0.0');
      expect(result.data.toString('utf8')).toBe('tarball-bytes');
    });

    it('throws on 404', async () => {
      server.setResponse(404, { error: 'Not found' });
      await expect(client().download('ghost', '9.9.9')).rejects.toThrow('HTTP 404');
    });
  });

  // ── publish ────────────────────────────────────────────────────────────────

  describe('publish()', () => {
    it('returns name, version, and integrity on 201', async () => {
      server.setResponse(201, { name: 'my-skill', version: '1.0.0', integrity: 'sha256-abc=' });
      const result = await client().publish(MANIFEST, { 'skill.md': '# Skill' });
      expect(result.name).toBe('my-skill');
      expect(result.integrity).toMatch(/^sha256-/);
    });

    it('sends a POST to /tools with JSON body', async () => {
      server.setResponse(201, { name: 'my-skill', version: '1.0.0', integrity: 'sha256-abc=' });
      await client().publish(MANIFEST, { 'skill.md': '# Skill' });
      const req = server.lastRequest();
      expect(req?.method).toBe('POST');
      expect(req?.url).toBe('/api/tools');
      const body = JSON.parse(req?.body ?? '{}') as { manifest: { name: string } };
      expect(body.manifest.name).toBe('my-skill');
    });

    it('throws on 409 conflict', async () => {
      server.setResponse(409, { error: 'my-skill@1.0.0 already published' });
      await expect(client().publish(MANIFEST, { 'skill.md': '# Skill' })).rejects.toThrow('already published');
    });

    it('throws on 400 validation error', async () => {
      server.setResponse(400, { error: 'Validation failed' });
      await expect(client().publish(MANIFEST, {})).rejects.toThrow();
    });

    it('throws on 401 when credentials are missing', async () => {
      server.setResponse(401, { error: 'Unauthorized' });
      await expect(client().publish(MANIFEST, { 'skill.md': '# Skill' })).rejects.toThrow();
    });
  });

  // ── authentication headers ─────────────────────────────────────────────────

  describe('authentication headers', () => {
    it('sends Authorization: Bearer when bearer auth is configured', async () => {
      server.setResponse(200, MANIFEST);
      await client({ type: 'bearer', token: 'my-token' }).getManifest('my-skill', '1.0.0');
      expect(server.lastRequest()?.headers['authorization']).toBe('Bearer my-token');
    });

    it('sends Authorization: Basic when basic auth is configured', async () => {
      server.setResponse(200, MANIFEST);
      await client({ type: 'basic', username: 'user', password: 'pass' }).getManifest('my-skill', '1.0.0');
      const expected = 'Basic ' + Buffer.from('user:pass').toString('base64');
      expect(server.lastRequest()?.headers['authorization']).toBe(expected);
    });

    it('sends no Authorization header when no auth is configured', async () => {
      server.setResponse(200, MANIFEST);
      await client().getManifest('my-skill', '1.0.0');
      expect(server.lastRequest()?.headers['authorization']).toBeUndefined();
    });
  });

  // ── network failures ───────────────────────────────────────────────────────

  describe('network failures', () => {
    it('rejects getManifest when the server is not reachable', async () => {
      // Port 1 is reserved and will refuse connections on all platforms.
      const unreachable = createRegistryClient({ name: 'dead', url: 'http://127.0.0.1:1' });
      await expect(unreachable.getManifest('any-tool', '1.0.0')).rejects.toThrow();
    });

    it('rejects search when the server is not reachable', async () => {
      const unreachable = createRegistryClient({ name: 'dead', url: 'http://127.0.0.1:1' });
      await expect(unreachable.search('query')).rejects.toThrow();
    });

    it('rejects download when the server is not reachable', async () => {
      const unreachable = createRegistryClient({ name: 'dead', url: 'http://127.0.0.1:1' });
      await expect(unreachable.download('any-tool', '1.0.0')).rejects.toThrow();
    });

    it('rejects publish when the server is not reachable', async () => {
      const unreachable = createRegistryClient({ name: 'dead', url: 'http://127.0.0.1:1' });
      await expect(unreachable.publish(MANIFEST, { 'skill.md': '# x' })).rejects.toThrow();
    });

    it('rejects on malformed JSON response from registry', async () => {
      server.setRawResponse(200, Buffer.from('not-json'), 'application/json');
      await expect(client().getManifest('my-skill', '1.0.0')).rejects.toThrow();
    });
  });
});

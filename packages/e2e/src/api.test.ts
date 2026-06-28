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
/**
 * API e2e tests.
 *
 * These run against a live registry server.  In CI the server is provided by
 * docker-compose (REGISTRY_URL=http://registry:4873).  Locally you can run:
 *
 *   npm test -w @bitgenetics/aitools-e2e
 *
 * global-setup.cjs starts a local registry automatically when REGISTRY_URL
 * points at localhost and nothing is listening yet.
 */

const BASE = (process.env['REGISTRY_URL'] ?? 'http://localhost:4873').replace(/\/$/, '');

/** Minimal valid tool manifest fixture. */
const FIXTURE_MANIFEST = {
  name: 'e2e-test-tool',
  version: '1.0.0',
  description: 'Tool used by e2e tests � safe to delete',
  category: 'skill' as const,
  scope: 'user' as const,
  platform: 'universal' as const,
  author: 'e2e',
  license: 'MIT',
  files: [{ src: 'index.md', dest: 'e2e-test-tool.md' }],
};

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...init,
  });
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} ? ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns status ok', async () => {
    const body = await json<{ status: string }>('/health');
    expect(body.status).toBe('ok');
  });

  it('includes upstreams count and time fields', async () => {
    const body = await json<{ upstreams: number; time: string }>('/health');
    expect(typeof body.upstreams).toBe('number');
    expect(typeof body.time).toBe('string');
  });
});

// ---------------------------------------------------------------------------

describe('POST /api/tools � publish', () => {
  it('publishes a new tool and returns 201 with integrity hash', async () => {
    const res = await api('/api/tools', {
      method: 'POST',
      body: JSON.stringify({
        manifest: FIXTURE_MANIFEST,
        files: { 'index.md': '# e2e test tool' },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { name: string; version: string; integrity: string };
    expect(body.name).toBe(FIXTURE_MANIFEST.name);
    expect(body.version).toBe(FIXTURE_MANIFEST.version);
    expect(typeof body.integrity).toBe('string');
  });

  it('returns 409 when the same version is published twice', async () => {
    const payload = {
      manifest: { ...FIXTURE_MANIFEST, version: '1.0.0-dup' },
      files: { 'index.md': '# duplicate' },
    };
    // First publish � must succeed
    const first = await api('/api/tools', { method: 'POST', body: JSON.stringify(payload) });
    expect(first.status).toBe(201);
    // Second publish same version � must conflict
    const second = await api('/api/tools', { method: 'POST', body: JSON.stringify(payload) });
    expect(second.status).toBe(409);
  });

  it('returns 400 when files map is missing a declared src', async () => {
    const res = await api('/api/tools', {
      method: 'POST',
      body: JSON.stringify({
        manifest: { ...FIXTURE_MANIFEST, version: '1.0.0-missing' },
        files: {}, // index.md is missing
      }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe('GET /api/tools � list', () => {
  it('returns an array containing the published tool', async () => {
    const tools = await json<unknown[]>('/api/tools');
    expect(Array.isArray(tools)).toBe(true);
    const found = (tools as Array<{ name: string }>).find(
      (t) => t.name === FIXTURE_MANIFEST.name,
    );
    expect(found).toBeDefined();
  });
});

// ---------------------------------------------------------------------------

describe('GET /api/tools/:name', () => {
  it('returns the manifest for a published tool', async () => {
    const manifest = await json<{ name: string; version: string }>(
      `/api/tools/${FIXTURE_MANIFEST.name}`,
    );
    expect(manifest.name).toBe(FIXTURE_MANIFEST.name);
  });

  it('returns 404 for an unknown tool', async () => {
    const res = await api('/api/tools/no-such-tool-xyz');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe('GET /api/tools/:name/:version', () => {
  it('returns the exact version manifest', async () => {
    const manifest = await json<{ version: string }>(
      `/api/tools/${FIXTURE_MANIFEST.name}/1.0.0`,
    );
    expect(manifest.version).toBe('1.0.0');
  });

  it('lists all versions via /versions pseudo-segment', async () => {
    const body = await json<{ name: string; versions: string[] }>(
      `/api/tools/${FIXTURE_MANIFEST.name}/versions`,
    );
    expect(body.versions).toContain('1.0.0');
  });

  it('returns 404 for an unknown version', async () => {
    const res = await api(`/api/tools/${FIXTURE_MANIFEST.name}/99.0.0`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe('GET /api/tools/:name/:version/tarball', () => {
  it('downloads a JSON tarball with correct content-disposition', async () => {
    const res = await api(`/api/tools/${FIXTURE_MANIFEST.name}/1.0.0/tarball`);
    expect(res.status).toBe(200);
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toContain(`${FIXTURE_MANIFEST.name}-1.0.0.json`);
  });

  it('returns 404 for an unknown version tarball', async () => {
    const res = await api(`/api/tools/${FIXTURE_MANIFEST.name}/99.0.0/tarball`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe('GET /api/search', () => {
  it('finds the published tool by name fragment', async () => {
    const results = await json<Array<{ name: string }>>('/api/search?q=e2e-test');
    expect(results.some((r) => r.name === FIXTURE_MANIFEST.name)).toBe(true);
  });

  it('returns an empty array for a query with no matches', async () => {
    const results = await json<unknown[]>('/api/search?q=zzz-no-match-xyzzy');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('GET /api/upstream', () => {
  it('returns an array (empty when no upstreams configured)', async () => {
    const upstreams = await json<unknown[]>('/api/upstream');
    expect(Array.isArray(upstreams)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('multi-version publish and resolution', () => {
  const MULTI_TOOL = 'e2e-multiversion-tool';

  beforeAll(async () => {
    for (const version of ['1.0.0', '2.0.0']) {
      await api('/api/tools', {
        method: 'POST',
        body: JSON.stringify({
          manifest: {
            name: MULTI_TOOL,
            version,
            description: 'multi-version e2e test',
            category: 'skill' as const,
            scope: 'user' as const,
            platform: 'universal' as const,
            author: 'e2e',
            license: 'MIT',
            files: [{ src: 'index.md', dest: `${MULTI_TOOL}.md` }],
          },
          files: { 'index.md': `# ${MULTI_TOOL} ${version}` },
        }),
      });
    }
  });

  it('GET /api/tools/:name returns the latest version', async () => {
    const manifest = await json<{ version: string }>(`/api/tools/${MULTI_TOOL}`);
    expect(manifest.version).toBe('2.0.0');
  });

  it('GET /api/tools/:name/latest resolves to the newest version', async () => {
    const manifest = await json<{ version: string }>(`/api/tools/${MULTI_TOOL}/latest`);
    expect(manifest.version).toBe('2.0.0');
  });

  it('GET /api/tools/:name/versions lists all published versions', async () => {
    const body = await json<{ versions: string[] }>(`/api/tools/${MULTI_TOOL}/versions`);
    expect(body.versions).toContain('1.0.0');
    expect(body.versions).toContain('2.0.0');
  });

  it('GET /api/tools/:name/1.0.0 returns the pinned older version', async () => {
    const manifest = await json<{ version: string }>(`/api/tools/${MULTI_TOOL}/1.0.0`);
    expect(manifest.version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------

describe('tarball body content', () => {
  it('is a JSON array of { path, content } entries', async () => {
    const res = await api(`/api/tools/${FIXTURE_MANIFEST.name}/1.0.0/tarball`);
    expect(res.status).toBe(200);
    const entries = await res.json() as Array<{ path: string; content: string }>;
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
    expect(typeof entries[0]!.path).toBe('string');
    expect(typeof entries[0]!.content).toBe('string');
  });

  it('contains the file content that was published', async () => {
    const res = await api(`/api/tools/${FIXTURE_MANIFEST.name}/1.0.0/tarball`);
    const entries = await res.json() as Array<{ path: string; content: string }>;
    const indexEntry = entries.find((e) => e.path === 'index.md');
    expect(indexEntry).toBeDefined();
    expect(indexEntry!.content).toContain('e2e test tool');
  });
});

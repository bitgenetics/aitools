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
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Registry Exploration Routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-'));

    // No upstreams for testing to avoid network calls
    app = await buildApp({
      dataDir: tempDir,
    });

    // Publish a test tool
    const manifestBlob = {
      name: 'my-skill',
      version: '1.0.0',
      description: 'A test skill',
      category: 'skill',
      keywords: ['testing', 'skill'],
      files: [{ src: 'SKILL.md', dest: 'my-skill/SKILL.md' }],
    };
    const filesBlob = { 'SKILL.md': '# My Skill' };

    const response = await app.inject({
      method: 'POST',
      url: '/api/tools',
      payload: { manifest: manifestBlob, files: filesBlob },
    });
    expect(response.statusCode).toBe(201);
  });

  it('GET /api/registries lists configured registries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registries',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.registries).toBeInstanceOf(Array);
    expect(body.registries.length).toBeGreaterThan(0);
    expect(body.registries.some((r: any) => r.isLocal)).toBe(true);
  });

  it('GET /api/search/all searches local registry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/all?q=skill',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.query).toBe('skill');
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0]).toHaveProperty('source', 'local');
    expect(body).toHaveProperty('page', 1);
    expect(body).toHaveProperty('pageSize', 10);
    expect(body).toHaveProperty('sortBy', 'age');
    expect(body).toHaveProperty('sortDir', 'desc');
  });

  it('GET /api/search/all returns empty results for no match', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/all?q=nonexistent-xyz',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total).toBe(0);
    expect(body.results).toEqual([]);
  });

  it('GET /api/search/all returns latest version only per tool', async () => {
    // Publish another version
    const manifestBlob = {
      name: 'my-skill',
      version: '2.0.0',
      description: 'A test skill v2',
      category: 'skill',
      files: [{ src: 'SKILL.md', dest: 'my-skill/SKILL.md' }],
    };
    const filesBlob = { 'SKILL.md': '# My Skill v2' };

    const publish2 = await app.inject({
      method: 'POST',
      url: '/api/tools',
      payload: { manifest: manifestBlob, files: filesBlob },
    });
    expect(publish2.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: '/api/search/all?q=my-skill',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.results.length).toBe(1);
    expect(body.total).toBe(1);
    expect(body.results[0].version).toBe('2.0.0');
  });

  it('GET /api/search/all supports name sorting and pagination', async () => {
    const tools = [
      {
        name: 'zeta-skill',
        version: '1.0.0',
        description: 'Z skill',
      },
      {
        name: 'alpha-skill',
        version: '1.0.0',
        description: 'A skill',
      },
    ];

    for (const tool of tools) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tools',
        payload: {
          manifest: {
            name: tool.name,
            version: tool.version,
            description: tool.description,
            category: 'skill',
            files: [{ src: 'SKILL.md', dest: `${tool.name}/SKILL.md` }],
          },
          files: { 'SKILL.md': `# ${tool.name}` },
        },
      });
      expect(res.statusCode).toBe(201);
    }

    const page1 = await app.inject({
      method: 'GET',
      url: '/api/search/all?sortBy=name&sortDir=asc&page=1&pageSize=2',
    });
    expect(page1.statusCode).toBe(200);
    const body1 = JSON.parse(page1.payload);
    expect(body1.total).toBeGreaterThanOrEqual(3);
    expect(body1.page).toBe(1);
    expect(body1.pageSize).toBe(2);
    expect(body1.totalPages).toBeGreaterThanOrEqual(2);
    expect(body1.results[0].name <= body1.results[1].name).toBe(true);

    const page2 = await app.inject({
      method: 'GET',
      url: '/api/search/all?sortBy=name&sortDir=asc&page=2&pageSize=2',
    });
    expect(page2.statusCode).toBe(200);
    const body2 = JSON.parse(page2.payload);
    expect(body2.page).toBe(2);
    expect(body2.results.length).toBeGreaterThan(0);
  });

  it('GET /api/registries includes configured upstream registries', async () => {
    const upstreamApp = await buildApp({
      dataDir: tempDir,
      upstreams: [{ name: 'remote', url: 'http://upstream.example.com' }],
    });

    const res = await upstreamApp.inject({
      method: 'GET',
      url: '/api/registries',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.registries.some((r: { name: string; isLocal: boolean }) => r.name === 'remote' && !r.isLocal)).toBe(
      true,
    );
  });

  it('GET /api/search/all merges upstream search results', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'remote-tool', version: '1.0.0', description: 'remote skill', publishedAt: '2020-01-01T00:00:00.000Z' },
      ],
    } as Response);

    try {
      const upstreamApp = await buildApp({
        dataDir: tempDir,
        upstreams: [{ name: 'remote', url: 'http://upstream.example.com' }],
      });

      const res = await upstreamApp.inject({
        method: 'GET',
        url: '/api/search/all?q=remote',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.results.some((r: { name: string; source: string }) => r.name === 'remote-tool' && r.source === 'remote')).toBe(
        true,
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('GET /api/search/all returns all local tools when q is omitted', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/all',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.query).toBe('*');
    expect(body.total).toBeGreaterThan(0);
  });

  it('GET /api/search/all deduplicates local results over upstream duplicates', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'my-skill', version: '1.0.0', description: 'remote duplicate' },
      ],
    } as Response);

    try {
      const upstreamApp = await buildApp({
        dataDir: tempDir,
        upstreams: [{ name: 'remote', url: 'http://upstream.example.com' }],
      });

      const res = await upstreamApp.inject({
        method: 'GET',
        url: '/api/search/all?q=my-skill',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.results.filter((r: { name: string }) => r.name === 'my-skill')).toHaveLength(1);
      expect(body.results[0].source).toBe('local');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('GET /api/search/all ignores upstream responses that are not arrays', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'an array' }),
    } as Response);

    try {
      const upstreamApp = await buildApp({
        dataDir: tempDir,
        upstreams: [{ name: 'remote', url: 'http://upstream.example.com' }],
      });

      const res = await upstreamApp.inject({
        method: 'GET',
        url: '/api/search/all?q=remote',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).results).toEqual([]);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('GET /api/search/all ignores upstream failures', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    try {
      const upstreamApp = await buildApp({
        dataDir: tempDir,
        upstreams: [{ name: 'remote', url: 'http://upstream.example.com' }],
      });

      const res = await upstreamApp.inject({
        method: 'GET',
        url: '/api/search/all?q=skill',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).results.some((r: { source: string }) => r.source === 'local')).toBe(
        true,
      );
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('GET /api/search/all ignores non-ok upstream responses', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => [],
    } as Response);

    try {
      const upstreamApp = await buildApp({
        dataDir: tempDir,
        upstreams: [{ name: 'remote', url: 'http://upstream.example.com' }],
      });

      const res = await upstreamApp.inject({
        method: 'GET',
        url: '/api/search/all?q=remote',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).results.every((r: { source: string }) => r.source === 'local')).toBe(
        true,
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('GET /api/search/all supports age sorting in ascending order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/all?sortBy=age&sortDir=asc',
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).sortBy).toBe('age');
    expect(JSON.parse(res.payload).sortDir).toBe('asc');
  });
});


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
import type { FastifyInstance } from 'fastify';
import type { ToolStore } from '../storage/tool-store.js';

export interface RegistryConfig {
  name: string;
  url: string;
}

/**
 * Register registry exploration routes.
 * These are PUBLIC routes for discovering tools across the registry ecosystem.
 *
 * GET /api/registries      — list configured upstream registries
 * GET /api/search/all      — search local + upstream registries
 */
export async function registerRegistryExplorationRoutes(
  fastify: FastifyInstance,
  store: ToolStore,
  upstreams: RegistryConfig[],
): Promise<void> {
  // GET /api/registries — list configured registries (including self)
  fastify.get('/api/registries', async (req, reply) => {
    const registries: Array<RegistryConfig & { isLocal: boolean }> = [];

    // Add local registry
    const protocol = req.protocol || 'http';
    const host = req.hostname || 'localhost';
    const baseUrl = `${protocol}://${host}`;
    registries.push({
      name: 'local',
      url: new URL('/api/tools', baseUrl).href,
      isLocal: true,
    });

    // Add upstreams
    for (const upstream of upstreams) {
      registries.push({
        ...upstream,
        isLocal: false,
      });
    }

    return reply.send({ registries });
  });

  // GET /api/search/all — search across all registries.
  // Supports optional query, sorting, and pagination.
  // Local results are latest-version only per tool name to keep list views concise.
  fastify.get<{
    Querystring: {
      q?: string;
      sortBy?: 'name' | 'age';
      sortDir?: 'asc' | 'desc';
      page?: string;
      pageSize?: string;
    };
  }>('/api/search/all', async (req, reply) => {
    const query = (req.query.q || '').trim().toLowerCase();
    const sortBy = req.query.sortBy === 'name' ? 'name' : 'age';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const parsedPage = parseInt(req.query.page || '1', 10);
    const parsedPageSize = parseInt(req.query.pageSize || '10', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, 100)
      : 10;

    // Search local registry (latest version only)
    const localResults: any[] = [];
    const allLocalTools = await store.search('');
    for (const tool of allLocalTools) {
      const toolName = tool.name;
      const stored = await store.get(toolName, 'latest');
      if (!stored) continue;
      const { manifest, publishedAt } = stored;

      const haystack = [
        manifest.name,
        manifest.description,
        manifest.category,
        ...(manifest.keywords ?? []),
        ...(manifest.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();

      if (!query || haystack.includes(query)) {
        localResults.push({
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          category: manifest.category,
          keywords: manifest.keywords,
          tags: manifest.tags,
          source: 'local',
          publishedAt,
        });
      }
    }

    // Search upstream registries
    const upstreamResults: any[] = [];
    for (const upstream of upstreams) {
      try {
        const searchUrl = new URL('/search', upstream.url);
        searchUrl.searchParams.append('q', query);

        const res = await fetch(searchUrl.href, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const tools = await res.json();
          if (Array.isArray(tools)) {
            upstreamResults.push(
              ...tools.map((t: any) => ({
                ...t,
                source: upstream.name,
              })),
            );
          }
        }
      } catch (err) {
        // Log but don't fail if one upstream is down
        console.warn(`Failed to search upstream "${upstream.name}":`, err);
      }
    }

    // Merge and deduplicate (prefer local, then first upstream)
    const seen = new Set<string>();
    const deduped = [...localResults, ...upstreamResults].filter((tool) => {
      const key = `${tool.name}@${tool.version}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sorted = [...deduped].sort((a, b) => {
      if (sortBy === 'name') {
        const cmp = String(a.name || '').localeCompare(String(b.name || ''));
        return sortDir === 'asc' ? cmp : -cmp;
      }

      const aTs = a.publishedAt ? Date.parse(String(a.publishedAt)) : 0;
      const bTs = b.publishedAt ? Date.parse(String(b.publishedAt)) : 0;
      if (aTs === bTs) {
        const fallback = String(a.name || '').localeCompare(String(b.name || ''));
        return sortDir === 'asc' ? fallback : -fallback;
      }
      return sortDir === 'asc' ? aTs - bTs : bTs - aTs;
    });

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const results = sorted.slice(start, end);

    return reply.send({
      query: query || '*',
      sortBy,
      sortDir,
      page: currentPage,
      pageSize,
      total,
      totalPages,
      results,
    });
  });
}

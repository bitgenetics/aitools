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
import https from 'node:https';
import http from 'node:http';
import { getPool } from '../db/client.js';

interface UpstreamConfig {
  name: string;
  url: string;
}

/**
 * Optional registry chaining routes.
 *
 * When upstreams are configured, requests that return no local results are
 * automatically forwarded to the upstream registry and the responses are
 * merged before returning to the client.
 *
 * GET /upstream        — list configured upstreams
 * GET /proxy/search    — search local + all upstreams
 */
export async function registerRegistryRoutes(
  fastify: FastifyInstance,
  upstreams: UpstreamConfig[],
): Promise<void> {
  fastify.get('/api/upstream', async (_req, reply) => {
    return reply.send(upstreams.map((u) => ({ name: u.name, url: u.url })));
  });

  // Health / info
  fastify.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      upstreams: upstreams.length,
      time: new Date().toISOString(),
    });
  });

  // Readiness probe — checks DB connectivity when a pool is available
  fastify.get('/health/ready', async (_req, reply) => {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
    } catch {
      // Pool not initialized (simple auth mode) or DB unreachable
      return reply.status(503).send({ status: 'unavailable', reason: 'database unreachable' });
    }
    return reply.send({ status: 'ready' });
  });

  // Proxy search across all upstreams and merge results
  fastify.get<{ Querystring: { q?: string } }>('/proxy/search', async (req, reply) => {
    const query = encodeURIComponent(req.query.q ?? '');
    const upstreamResults = await Promise.allSettled(
      upstreams.map((u) => fetchJSON(`${u.url.replace(/\/$/, '')}/search?q=${query}`)),
    );

    const merged: unknown[] = [];
    for (const result of upstreamResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        merged.push(...result.value);
      }
    }

    return reply.send(merged);
  });
}

function fetchJSON(url: string): Promise<unknown> {
  const TIMEOUT_MS = 10_000;
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`Upstream request timed out after ${TIMEOUT_MS}ms: ${url}`));
    });
  });
}

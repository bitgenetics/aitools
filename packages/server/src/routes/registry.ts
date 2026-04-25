import type { FastifyInstance } from 'fastify';
import https from 'node:https';
import http from 'node:http';

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
  fastify.get('/upstream', async (_req, reply) => {
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
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { Accept: 'application/json' } }, (res) => {
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
    }).on('error', reject);
  });
}

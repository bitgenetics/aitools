import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ToolManifestSchema } from '@ai-tools/core';
import type { ToolStore } from '../storage/tool-store.js';

const PublishBodySchema = z.object({
  manifest: ToolManifestSchema,
  /** Map of src path → file content. */
  files: z.record(z.string()),
});

/**
 * Register all /tools routes onto the Fastify instance.
 *
 * GET  /tools                      — list latest version of every tool
 * GET  /tools/:name                — get latest manifest for a tool
 * GET  /tools/:name/:version       — get specific version manifest
 * GET  /tools/:name/:version/tarball — download tool tarball
 * GET  /search?q=<query>           — search tools
 * POST /tools                      — publish a new tool version
 */
export async function registerToolRoutes(
  fastify: FastifyInstance,
  store: ToolStore,
): Promise<void> {
  // List all tools (latest version of each)
  fastify.get('/tools', async (_req, reply) => {
    const all = store.search('');
    return reply.send(all);
  });

  // Search
  fastify.get<{ Querystring: { q?: string } }>('/search', async (req, reply) => {
    const query = req.query.q ?? '';
    const results = store.search(query).map((m) => ({
      name: m.name,
      version: m.version,
      description: m.description,
      category: m.category,
      keywords: m.keywords,
      tags: m.tags,
    }));
    return reply.send(results);
  });

  // Get manifest (latest or specific version)
  fastify.get<{ Params: { name: string; version?: string } }>(
    '/tools/:name',
    async (req, reply) => {
      const stored = store.get(req.params.name, 'latest');
      if (!stored) return reply.status(404).send({ error: 'Not found' });
      return reply.send(stored.manifest);
    },
  );

  fastify.get<{ Params: { name: string; version: string } }>(
    '/tools/:name/:version',
    async (req, reply) => {
      if (req.params.version === 'versions') {
        const versions = store.listVersions(req.params.name);
        return reply.send({ name: req.params.name, versions });
      }
      const stored = store.get(req.params.name, req.params.version);
      if (!stored) return reply.status(404).send({ error: 'Not found' });
      return reply.send(stored.manifest);
    },
  );

  // Download tarball
  fastify.get<{ Params: { name: string; version: string } }>(
    '/tools/:name/:version/tarball',
    async (req, reply) => {
      try {
        const buf = store.buildTarball(req.params.name, req.params.version);
        return reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="${req.params.name}-${req.params.version}.json"`)
          .send(buf);
      } catch {
        return reply.status(404).send({ error: 'Not found' });
      }
    },
  );

  // Publish a tool
  fastify.post<{ Body: unknown }>('/tools', async (req, reply) => {
    const parsed = PublishBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { manifest, files } = parsed.data;

    // Verify all manifest.files[*].src keys exist in the files map
    const missing = manifest.files.filter((f) => !(f.src in files));
    if (missing.length > 0) {
      return reply.status(400).send({
        error: `Missing file content for: ${missing.map((f) => f.src).join(', ')}`,
      });
    }

    try {
      store.publish(manifest, files);
      return reply.status(201).send({
        name: manifest.name,
        version: manifest.version,
        integrity: store.integrity(manifest.name, manifest.version),
      });
    } catch (err) {
      return reply.status(409).send({ error: (err as Error).message });
    }
  });
}

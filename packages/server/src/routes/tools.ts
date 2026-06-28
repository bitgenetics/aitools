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
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ToolManifestSchema } from '@bitgenetics/aitools-core';
import type { ToolManifest } from '@bitgenetics/aitools-core';
import type { IAuthProvider } from '../providers/auth/types.js';
import { ToolStoreError } from '../storage/tool-store.js';
import type { ToolStore } from '../storage/tool-store.js';

// Route handlers for registry tool metadata and publishing.

const PublishBodySchema = z.object({
  manifest: ToolManifestSchema,
  /** Map of src path ? file content. */
  files: z.record(z.string()),
});

const PatchToolBodySchema = z.object({
  private: z.boolean(),
});

/**
 * Register all /tools routes onto the Fastify instance.
 *
 * GET  /tools                      � list latest version of every tool
 * GET  /tools/:name                � get latest manifest for a tool
 * GET  /tools/:name/:version       � get specific version manifest
 * GET  /tools/:name/:version/tarball � download tool tarball
 * GET  /search?q=<query>           � search tools
 * POST /tools                      � publish a new tool version
 */
export async function registerToolRoutes(
  fastify: FastifyInstance,
  store: ToolStore,
  auth: IAuthProvider,
  registryAccess: 'private' | 'public' = 'private',
): Promise<void> {
  /**
   * Resolve the caller's publisher identity (or undefined when unauthenticated).
   * In private mode all read endpoints call this; in public mode it is used to
   * decide whether to reveal private tools.
   */
  async function resolvePublisher(req: FastifyRequest) {
    const result = await auth.publisher.resolve(req.headers);
    return result.ok ? result.publisher : undefined;
  }

  /**
   * Enforce authentication in private mode.
   * Returns true when the request should proceed, false when a 401 was sent.
   */
  async function guardReadAuth(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<boolean> {
    if (registryAccess === 'public') return true;
    const result = await auth.publisher.resolve(req.headers);
    if (!result.ok) {
      await reply.status(result.statusCode).send({ error: result.error });
      return false;
    }
    return true;
  }

  /**
   * In public mode, filter out tools whose manifest has private: true.
   * In private mode (authenticated), all tools are visible.
   */
  function isVisible(manifest: ToolManifest, authenticated: boolean): boolean {
    if (authenticated) return true;
    return manifest.private !== true;
  }

  // List all tools (latest version of each)
  fastify.get('/api/tools', async (req, reply) => {
    if (!await guardReadAuth(req, reply)) return;
    const authenticated = registryAccess === 'private' || !!(await resolvePublisher(req));
    const all = await store.search('');
    return reply.send(all.filter((m) => isVisible(m, authenticated)));
  });

  // Search
  fastify.get<{ Querystring: { q?: string } }>('/api/search', async (req, reply) => {
    if (!await guardReadAuth(req, reply)) return;
    const authenticated = registryAccess === 'private' || !!(await resolvePublisher(req));
    const query = req.query.q ?? '';
    const results = (await store.search(query))
      .filter((m) => isVisible(m, authenticated))
      .map((m) => ({
        name: m.name,
        version: m.version,
        description: m.description,
        category: m.category,
        keywords: m.keywords,
        tags: m.tags,
      }));
    return reply.send(results);
  });

  // Get manifest (latest version)
  fastify.get<{ Params: { name: string; version?: string } }>(
    '/api/tools/:name',
    async (req, reply) => {
      if (!await guardReadAuth(req, reply)) return;
      const stored = await store.get(req.params.name, 'latest');
      if (!stored) return reply.status(404).send({ error: 'Not found' });
      const authenticated = registryAccess === 'private' || !!(await resolvePublisher(req));
      if (!isVisible(stored.manifest, authenticated)) return reply.status(404).send({ error: 'Not found' });
      return reply.send(stored.manifest);
    },
  );

  fastify.get<{ Params: { name: string; version: string } }>(
    '/api/tools/:name/:version',
    async (req, reply) => {
      if (!await guardReadAuth(req, reply)) return;
      const authenticated = registryAccess === 'private' || !!(await resolvePublisher(req));
      if (req.params.version === 'versions') {
        const versions = await store.listVersions(req.params.name);
        return reply.send({ name: req.params.name, versions });
      }
      if (req.params.version === 'owner') {
        const owner = await store.getOwner(req.params.name);
        if (!owner) return reply.status(404).send({ error: 'No ownership record' });
        return reply.send({ name: req.params.name, owner });
      }
      const stored = await store.get(req.params.name, req.params.version);
      if (!stored) return reply.status(404).send({ error: 'Not found' });
      if (!isVisible(stored.manifest, authenticated)) return reply.status(404).send({ error: 'Not found' });
      return reply.send(stored.manifest);
    },
  );

  // Download tarball
  fastify.get<{ Params: { name: string; version: string } }>(
    '/api/tools/:name/:version/tarball',
    async (req, reply) => {
      if (!await guardReadAuth(req, reply)) return;
      const authenticated = registryAccess === 'private' || !!(await resolvePublisher(req));
      // Check visibility before serving the tarball
      const stored = await store.get(req.params.name, req.params.version);
      if (stored && !isVisible(stored.manifest, authenticated)) {
        return reply.status(404).send({ error: 'Not found' });
      }
      try {
        const buf = await store.buildTarball(req.params.name, req.params.version);
        const integrityHash = await store.integrity(req.params.name, req.params.version);
        return reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="${req.params.name}-${req.params.version}.json"`)
          .header('X-Integrity', integrityHash)
          .send(buf);
      } catch {
        return reply.status(404).send({ error: 'Not found' });
      }
    },
  );

  // Resolve the current token to a user/org identity
  fastify.get('/api/me', async (req, reply) => {
    const result = await auth.publisher.resolve(req.headers);
    if (!result.ok) return reply.send({ authenticated: false });
    return reply.send({ authenticated: true, userId: result.publisher.userId, org: result.publisher.org });
  });

  // List all tools owned by a given org
  fastify.get<{ Params: { org: string } }>('/api/org/:org/tools', async (req, reply) => {
    if (!await guardReadAuth(req, reply)) return;
    const authenticated = registryAccess === 'private' || !!(await resolvePublisher(req));
    const all = await store.search('');
    const owned: typeof all = [];
    for (const m of all) {
      if (!isVisible(m, authenticated)) continue;
      try {
        const owner = await store.getOwner(m.name);
        if (owner?.org === req.params.org) owned.push(m);
      } catch { /* skip */ }
    }
    return reply.send(owned);
  });

  // Publish a tool
  fastify.post<{ Body: unknown }>(
    '/api/tools',
    {
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 hour',
          keyGenerator: (req) => req.headers.authorization ?? req.ip,
          errorResponseBuilder: () => ({ error: 'Publish rate limit exceeded. Try again later.' }),
        },
      },
    },
    async (req, reply) => {
    const authResult = await auth.publisher.resolve(req.headers);
    const publisher = authResult.ok ? authResult.publisher : undefined;

    // Reject unauthorized unless auth is in open mode (no token configured at all)
    if (!authResult.ok) {
      return reply.status(authResult.statusCode).send({ error: authResult.error });
    }

    const parsed = PublishBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { manifest, files } = parsed.data;

    const missing = manifest.files.filter((f) => !(f.src in files));
    if (missing.length > 0) {
      return reply.status(400).send({
        error: `Missing file content for: ${missing.map((f) => f.src).join(', ')}`,
      });
    }

    try {
      await store.publish(manifest, files, publisher);
      return reply.status(201).send({
        name: manifest.name,
        version: manifest.version,
        integrity: await store.integrity(manifest.name, manifest.version),
      });
    } catch (err) {
      if (err instanceof ToolStoreError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(409).send({ error: (err as Error).message });
    }
  },
  );

  // Update tool-level settings (owner org only)
  // PATCH /tools/:name   body: { private: boolean }
  fastify.patch<{ Params: { name: string }; Body: unknown }>('/api/tools/:name', async (req, reply) => {
    const authResult = await auth.publisher.resolve(req.headers);
    if (!authResult.ok) {
      return reply.status(authResult.statusCode).send({ error: authResult.error });
    }

    const parsed = PatchToolBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      await store.setPrivacy(req.params.name, parsed.data.private, authResult.publisher);
      return reply.send({ name: req.params.name, private: parsed.data.private });
    } catch (err) {
      if (err instanceof ToolStoreError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}

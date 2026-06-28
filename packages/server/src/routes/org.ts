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
import type { IAuthProvider } from '../providers/auth/types.js';
import type { AuthenticatedPublisher } from '../auth/publisher-auth.js';
import type { ToolStore } from '../storage/tool-store.js';

/**
 * Register org management routes.
 * All routes require Bearer token authentication.
 *
 * GET  /api/org/info          — get current user's org
 * GET  /api/org/tools         — list tools published by user's org
 * GET  /api/org/members       — get org members (from auth config)
 * POST /api/org/tools/:name/deprecate — mark tool version as deprecated
 * POST /api/org/tools/:name/unpublish — remove tool version
 */
export async function registerOrgRoutes(
  fastify: FastifyInstance,
  store: ToolStore,
  auth: IAuthProvider,
): Promise<void> {
  const requireAuth = (scope: FastifyInstance) => {
    scope.addHook('preHandler', async (req, reply) => {
      const result = await auth.publisher.resolve(req.headers);
      if (!result.ok) {
        return reply.status(result.statusCode).send({ error: result.error });
      }
      (req as any).publisher = result.publisher;
    });
  };

  fastify.register(async (scope) => {
    requireAuth(scope);

    scope.get('/info', async (req, reply) => {
      const publisher = (req as any).publisher as AuthenticatedPublisher;
      return reply.send({
        userId: publisher.userId,
        org: publisher.org,
        memberOrgs: [publisher.org],
      });
    });

    scope.get('/tools', async (req, reply) => {
      const publisher = (req as any).publisher as AuthenticatedPublisher;
      const allTools = await store.search('');
      const orgTools = [];
      for (const manifest of allTools) {
        const owner = await store.getOwner(manifest.name);
        if (owner?.org !== publisher.org) continue;
        const versions = await store.listVersions(manifest.name);
        orgTools.push({
          name: manifest.name,
          latestVersion: manifest.version,
          allVersions: versions,
          description: manifest.description,
          category: manifest.category,
          owner,
        });
      }
      return reply.send({ org: publisher.org, toolCount: orgTools.length, tools: orgTools });
    });

    scope.get('/members', async (req, reply) => {
      const publisher = (req as any).publisher as AuthenticatedPublisher;
      return reply.send({
        org: publisher.org,
        members: [],
        note: 'Use GET /api/admin/orgs/:name for member details',
      });
    });

    scope.post<{ Params: { name: string }; Querystring: { version?: string } }>(
      '/tools/:name/unpublish',
      async (req, reply) => {
        const publisher = (req as any).publisher as AuthenticatedPublisher;
        const { name } = req.params;
        const { version } = req.query;

        const owner = await store.getOwner(name);
        if (!owner) return reply.status(404).send({ error: 'Tool not found' });
        if (owner.org !== publisher.org) {
          return reply.status(403).send({
            error: `Tool "${name}" is owned by org "${owner.org}", not "${publisher.org}"`,
          });
        }

        try {
          if (version) {
            await store.unpublish(name, version);
            return reply.send({ success: true, message: `Unpublished ${name}@${version}` });
          } else {
            const versions = await store.listVersions(name);
            for (const v of versions) await store.unpublish(name, v);
            return reply.send({
              success: true,
              message: `Unpublished all ${versions.length} version(s) of ${name}`,
              removedVersions: versions,
            });
          }
        } catch (err) {
          return reply.status(500).send({
            error: `Failed to unpublish: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      },
    );

    scope.post<{ Params: { name: string }; Querystring: { version: string } }>(
      '/tools/:name/deprecate',
      async (req, reply) => {
        const publisher = (req as any).publisher as AuthenticatedPublisher;
        const { name } = req.params;
        const { version } = req.query;

        if (!version) return reply.status(400).send({ error: 'version query param required' });

        const owner = await store.getOwner(name);
        if (!owner) return reply.status(404).send({ error: 'Tool not found' });
        if (owner.org !== publisher.org) {
          return reply.status(403).send({
            error: `Tool "${name}" is owned by org "${owner.org}", not "${publisher.org}"`,
          });
        }

        try {
          await store.deprecate(name, version);
          return reply.send({ success: true, message: `Marked ${name}@${version} as deprecated` });
        } catch (err) {
          return reply.status(500).send({
            error: `Failed to deprecate: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      },
    );
  }, { prefix: '/api/org' });
}

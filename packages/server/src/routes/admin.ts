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
import crypto from 'node:crypto';
import { OrgStore } from '../storage/org-store.js';
import type { UserStore } from '../storage/user-store.js';
import type { IAdminAuth } from '../providers/auth/types.js';

/**
 * Admin portal routes for org setup and management.
 * All routes require either an X-Admin-Token header or a valid admin session cookie.
 */
export async function registerAdminRoutes(
  fastify: FastifyInstance,
  orgStore: OrgStore,
  adminAuth: IAdminAuth,
  userStore?: UserStore,
): Promise<void> {
  async function validateAdminToken(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieHeader = req.headers.cookie;
    const cookies = cookieHeader
      ? Object.fromEntries(cookieHeader.split(';').map((c) => c.trim().split('=').map(decodeURIComponent)))
      : {};
    const ok = await adminAuth.check({ headers: req.headers, cookies });
    if (!ok) {
      await reply.status(401).send({ error: 'Invalid or missing admin token' });
    }
  }

  fastify.post<{ Body: { name: string; metadata?: Record<string, unknown> } }>(
    '/api/admin/orgs',
    { onRequest: validateAdminToken },
    async (req, reply) => {
      const { name, metadata } = req.body;
      if (!name || typeof name !== 'string') {
        return reply.status(400).send({ error: 'name is required (string)' });
      }
      try {
        const org = await orgStore.createOrg(name, 'admin', metadata);
        return reply.status(201).send(org);
      } catch (err) {
        const error = err as any;
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    },
  );

  fastify.get<{ Querystring: { org?: string } }>(
    '/api/admin/orgs',
    { onRequest: validateAdminToken },
    async (_req, reply) => {
      const orgs = await orgStore.listOrgs();
      return reply.send({ orgs });
    },
  );

  fastify.get<{ Params: { name: string } }>(
    '/api/admin/orgs/:name',
    { onRequest: validateAdminToken },
    async (req, reply) => {
      const org = await orgStore.getOrg(req.params.name);
      if (!org) return reply.status(404).send({ error: 'Org not found' });
      return reply.send(org);
    },
  );

  fastify.post<{ Params: { name: string }; Body: { userId: string } }>(
    '/api/admin/orgs/:name/members',
    { onRequest: validateAdminToken },
    async (req, reply) => {
      const { name } = req.params;
      const { userId } = req.body;
      if (!userId || typeof userId !== 'string') {
        return reply.status(400).send({ error: 'userId is required (string)' });
      }
      try {
        const org = await orgStore.addMember(name, userId, 'admin');
        return reply.send(org);
      } catch (err) {
        const error = err as any;
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    },
  );

  fastify.delete<{ Params: { name: string } }>(
    '/api/admin/orgs/:name',
    { onRequest: validateAdminToken },
    async (req, reply) => {
      try {
        await orgStore.deleteOrg(req.params.name, 'admin');
        return reply.send({ success: true });
      } catch (err) {
        const error = err as any;
        return reply.status(error.statusCode || 500).send({ error: error.message });
      }
    },
  );

  fastify.post<{ Body: { org: string; userId: string } }>(
    '/api/admin/tokens',
    { onRequest: validateAdminToken },
    async (req, reply) => {
      const { org, userId } = req.body;
      if (!org || !userId) {
        return reply.status(400).send({ error: 'org and userId are required' });
      }
      const orgData = await orgStore.getOrg(org);
      if (!orgData) return reply.status(404).send({ error: 'Org not found' });
      if (!orgData.members.includes(userId)) {
        return reply.status(403).send({ error: 'User is not a member of this org' });
      }

      if (userStore) {
        const userRecord = await userStore.getUserByUsername(userId);
        if (!userRecord) {
          return reply.status(404).send({
            error: `User "${userId}" has no registered account. They must POST /api/auth/register first.`,
          });
        }
        const { token, id } = await userStore.createToken(userRecord.id, org, 'admin-generated');
        return reply.send({ token, tokenId: id, org, userId });
      }

      const token = crypto.randomBytes(32).toString('hex');
      return reply.send({
        token,
        org,
        userId,
        envEntry: `${org.toUpperCase()}_${userId.toUpperCase()}=${token}`,
        note: 'Add this token to PUBLISHER_TOKENS env var or to .env file',
      });
    },
  );

  fastify.get<{ Querystring: { org?: string } }>(
    '/api/admin/audit-log',
    { onRequest: validateAdminToken },
    async (req, reply) => {
      const entries = await orgStore.getAuditLog(req.query.org);
      return reply.send({ entries });
    },
  );
}

export function generateAdminToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

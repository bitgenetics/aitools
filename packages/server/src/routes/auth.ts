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
import { UserStore } from '../storage/user-store.js';
import { OrgStore } from '../storage/org-store.js';

/**
 * Auth routes for user registration, login, and API token management.
 *
 * POST /api/auth/register   — create a new user account
 * POST /api/auth/login      — authenticate and receive a bearer token
 * GET  /api/auth/tokens     — list the current user's tokens  (requires Bearer)
 * POST /api/auth/tokens     — create a new API token for an org (requires Bearer)
 * DELETE /api/auth/tokens/:id — revoke a token               (requires Bearer)
 */
export async function registerAuthRoutes(
  fastify: FastifyInstance,
  userStore: UserStore,
  orgStore: OrgStore,
): Promise<void> {
  /**
   * Validate an incoming Bearer token and attach `req.authUser` to the request.
   * Used as a preHandler for authenticated routes.
   */
  async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await userStore.resolveFromHeaders(req.headers);
    if (!result.ok) {
      await reply.status(result.statusCode).send({ error: result.error });
      return;
    }
    // Attach resolved identity for handler use
    const resolved = await userStore.resolveToken(
      req.headers.authorization!.slice('Bearer '.length).trim(),
    );
    (req as any).authUser = resolved;
  }

  // ---------------------------------------------------------------------------
  // POST /api/auth/register
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: { username: string; password: string } }>(
    '/api/auth/register',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
          errorResponseBuilder: () => ({ error: 'Too many registration attempts. Try again later.' }),
        },
      },
    },
    async (req, reply) => {
      const { username, password } = req.body ?? {};

      if (!username || typeof username !== 'string' || username.trim().length < 2) {
        return reply.status(400).send({ error: 'username must be at least 2 characters' });
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        return reply.status(400).send({ error: 'password must be at least 8 characters' });
      }

      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
        return reply
          .status(400)
          .send({ error: 'username may only contain letters, numbers, hyphens, and underscores' });
      }

      try {
        const user = await userStore.createUser(cleanUsername, password);
        return reply.status(201).send({ id: user.id, username: user.username });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // Postgres unique-violation code
        if (message.includes('duplicate key') || message.includes('unique')) {
          return reply.status(409).send({ error: `Username "${cleanUsername}" is already taken` });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/auth/login
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: { username: string; password: string; org?: string } }>(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => ({ error: 'Too many login attempts. Try again later.' }),
        },
      },
    },
    async (req, reply) => {
      const { username, password, org } = req.body ?? {};

      if (!username || !password) {
        return reply.status(400).send({ error: 'username and password are required' });
      }

      const user = await userStore.loginUser(username.trim().toLowerCase(), password);
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // If an org is specified, verify the user is a member
      if (org) {
        const orgData = await orgStore.getOrg(org);
        if (!orgData) {
          return reply.status(404).send({ error: `Org "${org}" not found` });
        }
        if (!orgData.members.includes(user.username)) {
          return reply.status(403).send({ error: `Not a member of org "${org}"` });
        }
        const { token, id } = await userStore.createToken(user.id, org, 'login');
        return reply.send({ token, tokenId: id, username: user.username, org });
      }

      // No org: create a token for the first org the user belongs to
      // Caller can then use POST /api/auth/tokens with a specific org
      const allOrgs = (await orgStore.listOrgs()).filter((o) => o.members.includes(user.username));
      if (allOrgs.length === 0) {
        return reply.status(403).send({
          error: 'User is not a member of any org. Ask an admin to add you to an org first.',
        });
      }
      if (allOrgs.length > 1) {
        return reply.status(400).send({
          error:
            'User belongs to multiple orgs. Specify "org" in the request body to select one.',
          orgs: allOrgs.map((o) => o.name),
        });
      }

      const { token, id } = await userStore.createToken(user.id, allOrgs[0]!.name, 'login');
      return reply.send({ token, tokenId: id, username: user.username, org: allOrgs[0]!.name });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/auth/tokens  (authenticated)
  // ---------------------------------------------------------------------------
  fastify.get(
    '/api/auth/tokens',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = (req as any).authUser;
      const tokens = await userStore.listTokens(userId);
      return reply.send({ tokens });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/auth/tokens  (authenticated — create a personal access token)
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: { org: string; description?: string; expiresAt?: string } }>(
    '/api/auth/tokens',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { org, description, expiresAt } = req.body ?? {};
      const { userId, username } = (req as any).authUser;

      if (!org || typeof org !== 'string') {
        return reply.status(400).send({ error: 'org is required' });
      }

      const orgData = await orgStore.getOrg(org);
      if (!orgData) {
        return reply.status(404).send({ error: `Org "${org}" not found` });
      }
      if (!orgData.members.includes(username)) {
        return reply.status(403).send({ error: `Not a member of org "${org}"` });
      }

      let expiresAtDate: Date | null = null;
      if (expiresAt) {
        expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          return reply.status(400).send({ error: 'expiresAt must be a valid ISO date string' });
        }
        if (expiresAtDate <= new Date()) {
          return reply.status(400).send({ error: 'expiresAt must be in the future' });
        }
      }

      const { token, id } = await userStore.createToken(userId, org, description, expiresAtDate);
      return reply.status(201).send({
        token,
        tokenId: id,
        org,
        expiresAt: expiresAtDate?.toISOString() ?? null,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // DELETE /api/auth/tokens/:id  (authenticated)
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/api/auth/tokens/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const tokenId = parseInt(req.params.id, 10);
      if (!Number.isFinite(tokenId)) {
        return reply.status(400).send({ error: 'Invalid token id' });
      }

      const { userId } = (req as any).authUser;
      const deleted = await userStore.deleteToken(tokenId, userId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Token not found' });
      }
      return reply.send({ success: true });
    },
  );
}

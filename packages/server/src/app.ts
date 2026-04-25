// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import path from 'node:path';
import { ToolStore } from './storage/tool-store.js';
import { OrgStore } from './storage/org-store.js';
import { registerToolRoutes } from './routes/tools.js';
import { registerRegistryRoutes } from './routes/registry.js';
import { registerPortalRoutes } from './routes/portal.js';
import { registerOrgRoutes } from './routes/org.js';
import { registerRegistryExplorationRoutes } from './routes/registry-exploration.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import type { PublisherAuthConfig } from './auth/publisher-auth.js';
import type { UserStore } from './storage/user-store.js';
import type { IStorageProvider } from './providers/storage/types.js';
import type { IAuthProvider } from './providers/auth/types.js';
import { LocalStorageProvider } from './providers/storage/local.js';
import { SimpleAuthProvider } from './providers/auth/simple.js';
import { DatabaseAuthProvider } from './providers/auth/database.js';

export interface ServerOptions {
  /** Directory where tool data is persisted. Defaults to ./data */
  dataDir?: string;
  /** Port to listen on. Defaults to 4873. */
  port?: number;
  /** Host to bind to. Defaults to 0.0.0.0 */
  host?: string;
  /** Upstream registries to chain. */
  upstreams?: Array<{ name: string; url: string }>;
  /** Enable request logging. */
  logger?: boolean;
  /**
   * Storage provider. When set, takes precedence over dataDir.
   */
  storageProvider?: IStorageProvider;
  /**
   * Auth provider. When set, takes precedence over all legacy token/userStore options.
   */
  authProvider?: IAuthProvider;
  /**
   * Legacy bearer token required to publish tools via POST /tools.
   * @deprecated Use authProvider instead.
   */
  publishToken?: string;
  /**
   * Token→user/org auth config for org-aware write authorization.
   * @deprecated Use authProvider instead.
   */
  publisherAuthConfig?: PublisherAuthConfig;
  /**
   * DB-backed user store for token resolution.
   * @deprecated Use authProvider instead.
   */
  userStore?: UserStore;
  /**
   * Admin token for /portal/admin access.
   * @deprecated Use authProvider instead.
   */
  adminToken?: string;
  /**
   * Controls read access to the registry.
   *
   * - `'private'` (default): all read endpoints require publisher auth. Use this
   *   when the registry is for a closed group.
   * - `'public'`: read endpoints are open with no auth required. Tools published
   *   with `"private": true` in their manifest are hidden from unauthenticated
   *   callers. Write endpoints (publish) still require auth.
   */
  registryAccess?: 'private' | 'public';
}

/**
 * Build and configure the Fastify application.
 * Separated from listen() so it can be used in tests without binding a port.
 */
export async function buildApp(options: ServerOptions = {}) {
  // Validate upstream URLs at startup to prevent SSRF via misconfigured entries.
  for (const upstream of options.upstreams ?? []) {
    let parsed: URL;
    try {
      parsed = new URL(upstream.url);
    } catch {
      throw new Error(`Invalid upstream URL for "${upstream.name}": "${upstream.url}" is not a valid URL`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid upstream URL for "${upstream.name}": must use http or https, got "${parsed.protocol}"`);
    }
  }

  const corsOrigins = process.env['CORS_ORIGINS'];
  const fastify = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 10 * 1024 * 1024, // 10 MB
    genReqId: () => Math.random().toString(36).slice(2),
  });

  // Security headers
  await fastify.register(helmet, { global: true });

  // CORS — restrict to configured origins in production
  await fastify.register(cors, {
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : false,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    global: false, // apply per-route via config
  });

  // Global error handler — prevents stack trace leakage
  fastify.setErrorHandler((error, _request, reply) => {
    const fastifyError = error as { statusCode?: number; message: string };
    const statusCode = fastifyError.statusCode ?? 500;
    fastify.log.error({ err: error, statusCode }, fastifyError.message);
    if (statusCode >= 500) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
    return reply.status(statusCode).send({ error: fastifyError.message });
  });

  // ── Storage ────────────────────────────────────────────────────────────────
  const dataDir = options.dataDir ?? path.resolve(process.cwd(), 'data');
  const storageProvider: IStorageProvider =
    options.storageProvider ?? new LocalStorageProvider(dataDir);
  const store = new ToolStore(storageProvider);
  const orgStore = new OrgStore(storageProvider);

  // ── Auth ───────────────────────────────────────────────────────────────────
  let authProvider: IAuthProvider;
  if (options.authProvider) {
    authProvider = options.authProvider;
  } else if (options.userStore) {
    authProvider = new DatabaseAuthProvider(options.userStore, options.adminToken);
  } else {
    authProvider = new SimpleAuthProvider(
      options.publisherAuthConfig,
      options.publishToken,
      options.adminToken,
    );
    if (options.logger && !options.publishToken && !options.publisherAuthConfig) {
      console.warn(
        '[ai-tools] WARNING: publish endpoint is unauthenticated. ' +
          'Set DATABASE_URL with user auth (preferred), AI_TOOLS_PUBLISHER_TOKENS, or AI_TOOLS_PUBLISH_TOKEN.',
      );
    }
  }

  // ── Routes ─────────────────────────────────────────────────────────────────
  await registerToolRoutes(fastify, store, authProvider, options.registryAccess ?? 'private');
  await registerRegistryRoutes(fastify, options.upstreams ?? []);
  await registerRegistryExplorationRoutes(fastify, store, options.upstreams ?? []);
  await registerOrgRoutes(fastify, store, authProvider);

  // Admin portal and API are only registered when admin auth is configured.
  const hasAdminConfig = !!(options.adminToken || options.userStore || options.authProvider);
  await registerPortalRoutes(fastify, hasAdminConfig ? authProvider.admin : undefined);
  await registerAdminRoutes(fastify, orgStore, authProvider.admin, options.userStore);
  if (authProvider.userManagement) {
    // auth.ts still uses UserStore directly — wire the userStore through
    const userStore = options.userStore ?? (authProvider as DatabaseAuthProvider).userStore;
    await registerAuthRoutes(fastify, userStore, orgStore);
  }

  return fastify;
}

/**
 * Build the app and start listening.
 * @returns the address the server is listening on.
 */
export async function startServer(
  options: ServerOptions = {},
): Promise<{ address: string }> {
  const fastify = await buildApp(options);
  const port = options.port ?? 4873;
  const host = options.host ?? '0.0.0.0';
  const address = await fastify.listen({ port, host });
  return { address };
}

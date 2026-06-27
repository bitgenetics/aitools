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
import { config as loadEnv } from 'dotenv';
import { buildApp } from './app.js';
import { initPool, closePool } from './db/client.js';
import { runMigrations, seedAdminUser } from './db/migrations.js';
import { startTokenCleanup } from './db/cleanup.js';
import { UserStore } from './storage/user-store.js';
import { createStorageProvider } from './providers/storage/index.js';
import { createAuthProvider } from './providers/auth/index.js';

loadEnv();

// ── Startup environment validation ────────────────────────────────────────────
const AUTH_BACKEND = process.env['AUTH_BACKEND'] ?? 'simple';
const DATABASE_URL = process.env['DATABASE_URL'];

if (AUTH_BACKEND === 'database' && !DATABASE_URL) {
  console.error('[aitools] FATAL: AUTH_BACKEND=database requires DATABASE_URL to be set.');
  process.exit(1);
}
if (AUTH_BACKEND === 'oidc') {
  if (!process.env['OIDC_ISSUER']) {
    console.error('[aitools] FATAL: AUTH_BACKEND=oidc requires OIDC_ISSUER to be set.');
    process.exit(1);
  }
  if (!process.env['OIDC_AUDIENCE']) {
    console.error('[aitools] FATAL: AUTH_BACKEND=oidc requires OIDC_AUDIENCE to be set.');
    process.exit(1);
  }
}

const parsedPort = parseInt(process.env['PORT'] ?? '4873', 10);
const PORT = Number.isFinite(parsedPort) ? parsedPort : 4873;
const HOST = process.env['HOST'] ?? '0.0.0.0';
const UPSTREAMS = parseUpstreams(process.env['UPSTREAMS']);
const REGISTRY_ACCESS = (process.env['REGISTRY_ACCESS'] ?? 'private') as 'private' | 'public';

async function main() {
  // ── Storage provider ───────────────────────────────────────────────────────
  const storageProvider = createStorageProvider();

  // ── Auth provider ──────────────────────────────────────────────────────────
  let userStore: UserStore | undefined;
  let stopCleanup: (() => void) | undefined;
  if (DATABASE_URL) {
    try {
      const pool = initPool(DATABASE_URL);
      await runMigrations(pool);
      await seedAdminUser(pool);
      userStore = new UserStore(pool);
      stopCleanup = startTokenCleanup(pool);
      console.log('[aitools] Database connected and schema ready.');
    } catch (err) {
      console.error('[aitools] Failed to connect to database:', err);
      console.warn('[aitools] Falling back to env-var token auth.');
    }
  }

  const authProvider = createAuthProvider(userStore ? { backend: 'database', userStore } : undefined);

  const fastify = await buildApp({
    port: PORT,
    host: HOST,
    storageProvider,
    authProvider,
    upstreams: UPSTREAMS,
    registryAccess: REGISTRY_ACCESS,
    logger: true,
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully…`);
    try {
      stopCleanup?.();
      await fastify.close();
      await closePool();
      fastify.log.info('Server closed cleanly.');
      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  const address = await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`AITools registry server running at ${address}`);
}

main().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

/**
 * Parse a comma-separated list of "name=url" upstream entries.
 * Example: UPSTREAMS=public=https://registry.ai-tools.dev,internal=https://internal.example.com
 */
function parseUpstreams(
  raw: string | undefined,
): Array<{ name: string; url: string }> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => {
      const [name, ...rest] = entry.trim().split('=');
      return { name: name ?? '', url: rest.join('=') };
    })
    .filter((u) => u.name && u.url);
}

export { buildApp, startServer } from './app.js';

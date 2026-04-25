import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'node:path';
import { ToolStore } from './storage/tool-store.js';
import { registerToolRoutes } from './routes/tools.js';
import { registerRegistryRoutes } from './routes/registry.js';

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
}

/**
 * Build and configure the Fastify application.
 * Separated from listen() so it can be used in tests without binding a port.
 */
export async function buildApp(options: ServerOptions = {}) {
  const fastify = Fastify({ logger: options.logger ?? false });

  await fastify.register(cors, { origin: true });

  const dataDir = options.dataDir ?? path.resolve(process.cwd(), 'data');
  const store = new ToolStore(dataDir);

  await registerToolRoutes(fastify, store);
  await registerRegistryRoutes(fastify, options.upstreams ?? []);

  return fastify;
}

/**
 * Build and start the server, returning the Fastify instance and bound address.
 */
export async function startServer(options: ServerOptions = {}): Promise<{
  app: Awaited<ReturnType<typeof buildApp>>;
  address: string;
}> {
  const app = await buildApp(options);
  const address = await app.listen({
    port: options.port ?? 4873,
    host: options.host ?? '0.0.0.0',
  });
  return { app, address };
}

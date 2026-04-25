import { startServer } from './app.js';

const PORT = parseInt(process.env['PORT'] ?? '4873', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const DATA_DIR = process.env['AI_TOOLS_DATA_DIR'];
const UPSTREAMS = parseUpstreams(process.env['UPSTREAMS']);

startServer({
  port: PORT,
  host: HOST,
  dataDir: DATA_DIR,
  upstreams: UPSTREAMS,
  logger: true,
})
  .then(({ address }) => {
    console.log(`ai-tools registry server running at ${address}`);
  })
  .catch((err: unknown) => {
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

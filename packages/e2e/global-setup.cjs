/** @typedef {{ started: boolean; pid?: number; dataDir?: string }} E2eServerState */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setupGiteaRegistry } = require('./gitea-setup.cjs');

const REGISTRY_URL = (process.env['REGISTRY_URL'] ?? 'http://localhost:4873').replace(/\/$/, '');
const STATE_FILE = path.join(os.tmpdir(), 'aitools-e2e-server-state.json');
const REPO_ROOT = path.resolve(__dirname, '../..');
const SERVER_ENTRY = path.join(REPO_ROOT, 'packages/server/dist/index.js');

async function isHealthy(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealthy(baseUrl, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    if (await isHealthy(baseUrl)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureHttpRegistry() {
  if (await isHealthy(REGISTRY_URL)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ started: false }));
    return;
  }

  const parsed = new URL(REGISTRY_URL);
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (!isLocal) {
    throw new Error(
      `E2E registry not reachable at ${REGISTRY_URL}. Start it or set REGISTRY_URL to a running server.`,
    );
  }

  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error(
      `Registry server not built at ${SERVER_ENTRY}. Run: npm run build -w @bitgenetics/aitools-server`,
    );
  }

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-e2e-data-'));
  const port = parsed.port || '4873';

  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: port,
      HOST: '127.0.0.1',
      AITOOLS_DATA_DIR: dataDir,
      AUTH_BACKEND: 'simple',
      REGISTRY_ACCESS: 'private',
    },
    stdio: 'pipe',
    windowsHide: true,
  });

  child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk) => process.stdout.write(chunk));

  const healthy = await waitForHealthy(REGISTRY_URL);
  if (!healthy) {
    child.kill();
    throw new Error(`Failed to start e2e registry server at ${REGISTRY_URL}`);
  }

  /** @type {E2eServerState} */
  const state = { started: true, pid: child.pid, dataDir };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));

  global.__AITOOLS_E2E_SERVER__ = child;
}

/** @returns {Promise<void>} */
module.exports = async function globalSetup() {
  await ensureHttpRegistry();

  if (process.env['GITEA_URL']) {
    const gitRegistry = await setupGiteaRegistry();
    process.stdout.write(
      `[e2e] Gitea git registry ready: ${gitRegistry.provider} ${gitRegistry.url}\n`,
    );
  }
};

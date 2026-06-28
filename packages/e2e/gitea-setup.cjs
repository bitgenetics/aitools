/** @typedef {{ url: string; name: string; provider: string }} GitRegistryState */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GITEA_URL = (process.env['GITEA_URL'] ?? 'http://gitea:3000').replace(/\/$/, '');
const GITEA_ADMIN_USER = process.env['GITEA_ADMIN_USER'] ?? 'e2e';
const GITEA_ADMIN_PASSWORD = process.env['GITEA_ADMIN_PASSWORD'] ?? 'e2e-test-pass';
const GITEA_ADMIN_EMAIL = process.env['GITEA_ADMIN_EMAIL'] ?? 'e2e@test.com';
const GITEA_REPO_OWNER = process.env['GITEA_REPO_OWNER'] ?? GITEA_ADMIN_USER;
const GITEA_REPO_NAME = process.env['GITEA_REPO_NAME'] ?? 'tools-registry';
const GIT_REGISTRY_NAME = process.env['GIT_REGISTRY_NAME'] ?? 'e2e-git-registry';
const STATE_FILE =
  process.env['GIT_REGISTRY_STATE_FILE'] ??
  path.join(os.tmpdir(), 'aitools-e2e-git-registry.json');

function basicAuthHeader(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

async function waitForGitea(attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${GITEA_URL}/api/healthz`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Gitea not healthy at ${GITEA_URL}`);
}

async function isGiteaInstalled() {
  const res = await fetch(`${GITEA_URL}/api/v1/version`);
  return res.ok;
}

async function ensureRepository() {
  const auth = basicAuthHeader(GITEA_ADMIN_USER, GITEA_ADMIN_PASSWORD);
  const listRes = await fetch(
    `${GITEA_URL}/api/v1/repos/${GITEA_REPO_OWNER}/${GITEA_REPO_NAME}`,
    { headers: { Authorization: auth } },
  );

  if (listRes.status === 404) {
    const createRes = await fetch(`${GITEA_URL}/api/v1/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: GITEA_REPO_NAME,
        auto_init: true,
        default_branch: 'main',
        private: false,
      }),
    });
    if (!createRes.ok && createRes.status !== 409) {
      const text = await createRes.text();
      throw new Error(`Failed to create Gitea repo (${createRes.status}): ${text}`);
    }
  } else if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Failed to query Gitea repo (${listRes.status}): ${text}`);
  }
}

function branchExists(cwd, branch) {
  const result = spawnSync('git', ['rev-parse', '--verify', branch], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return result.status === 0;
}

function runGit(args, cwd, extraEnv = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv,
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`,
    );
  }
}

function seedRegistryTree(cloneUrl) {
  const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-gitea-seed-'));
  const workDir = path.join(parentDir, 'repo');
  runGit(['clone', cloneUrl, 'repo'], parentDir);
  runGit(['config', 'user.email', GITEA_ADMIN_EMAIL], workDir);
  runGit(['config', 'user.name', GITEA_ADMIN_USER], workDir);

  const registryDir = path.join(workDir, 'registry');
  if (!fs.existsSync(registryDir)) {
    fs.mkdirSync(registryDir, { recursive: true });
    fs.writeFileSync(path.join(registryDir, '.gitkeep'), '\n', 'utf8');
    runGit(['add', 'registry'], workDir);
    runGit(['commit', '-m', 'init git registry root'], workDir);
    if (!branchExists(workDir, 'main')) {
      runGit(['branch', '-M', 'main'], workDir);
    }
    runGit(['push', '-u', 'origin', 'main'], workDir);
  }

  fs.rmSync(parentDir, { recursive: true, force: true });
}

function buildCloneUrl() {
  const parsed = new URL(GITEA_URL);
  parsed.username = encodeURIComponent(GITEA_ADMIN_USER);
  parsed.password = encodeURIComponent(GITEA_ADMIN_PASSWORD);
  parsed.pathname = `/${GITEA_REPO_OWNER}/${GITEA_REPO_NAME}.git`;
  return parsed.toString();
}

/** @returns {Promise<GitRegistryState>} */
async function setupGiteaRegistry() {
  await waitForGitea();

  if (!(await isGiteaInstalled())) {
    throw new Error(
      `Gitea API unavailable at ${GITEA_URL}. Ensure gitea-init completed successfully.`,
    );
  }

  await ensureRepository();

  const cloneUrl = buildCloneUrl();
  seedRegistryTree(cloneUrl);

  /** @type {GitRegistryState} */
  const state = {
    url: cloneUrl,
    name: GIT_REGISTRY_NAME,
    provider: 'gitea',
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  return state;
}

module.exports = { setupGiteaRegistry, STATE_FILE };

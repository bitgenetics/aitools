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
/**
 * Shared e2e test environment helpers.
 *
 * Uses an isolated HOME/USERPROFILE so tests do not inherit the developer's
 * ai-tools.config.json. The registry server is started by global-setup.cjs
 * when REGISTRY_URL points at localhost and nothing is listening yet.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REGISTRY_URL = (process.env['REGISTRY_URL'] ?? 'http://localhost:4873').replace(/\/$/, '');

const GIT_REGISTRY_STATE_FILE =
  process.env['GIT_REGISTRY_STATE_FILE'] ??
  path.join(os.tmpdir(), 'ai-tools-e2e-git-registry.json');

export interface GitRegistryRemote {
  url: string;
  name: string;
  provider?: string;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_CLI = `node ${path.join(REPO_ROOT, 'packages/cli/dist/cli.js')}`;
const CLI = process.env['AI_TOOLS_CLI'] ?? DEFAULT_CLI;

/** Empty home directory — prevents user-level config from affecting e2e runs. */
export const E2E_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-home-'));

/** Create a project directory under E2E_HOME so config cascade does not walk into the real user profile. */
export function makeE2eProjectDir(prefix = 'ai-tools-e2e-'): string {
  return fs.mkdtempSync(path.join(E2E_HOME, prefix));
}

export function resolveCliCommand(): string {
  const parts = CLI.trim().split(/\s+/);
  if (parts[0] === 'node' && parts[1] && !path.isAbsolute(parts[1])) {
    return `node ${path.join(REPO_ROOT, parts[1])}`;
  }
  return CLI;
}

export function isolatedEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: E2E_HOME,
    USERPROFILE: E2E_HOME,
    AI_TOOLS_CONFIG_ROOT: E2E_HOME,
  };
}

export function run(args: string, cwd?: string): string {
  return execSync(`${resolveCliCommand()} ${args}`, {
    cwd,
    encoding: 'utf8',
    env: isolatedEnv(),
  }).trim();
}

export function runGit(args: string[], cwd: string): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: isolatedEnv() });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`,
    );
  }
}

export function rmTmpDir(dir: string | undefined): void {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Remote git registry prepared by global-setup (Gitea in Docker). */
export function getGitRegistryRemote(): GitRegistryRemote | null {
  if (!fs.existsSync(GIT_REGISTRY_STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(GIT_REGISTRY_STATE_FILE, 'utf8')) as GitRegistryRemote;
}

/** Use Gitea when available, otherwise create a local bare repo. */
export function initGitRegistry(): { url: string; tmpRoot: string | null; name: string } {
  const remote = getGitRegistryRemote();
  if (remote) {
    return { url: remote.url, tmpRoot: null, name: remote.name };
  }

  const local = initBareGitRegistry();
  return { url: local.barePath, tmpRoot: local.tmpRoot, name: 'e2e-git-registry' };
}

/** Publish a minimal tool fixture to the HTTP registry so CLI tests can find it. */
export async function publishFixture(name: string, version: string): Promise<void> {
  const manifest = {
    name,
    version,
    description: `CLI e2e fixture: ${name}`,
    category: 'skill',
    scope: 'user',
    platform: 'universal',
    author: 'e2e',
    license: 'MIT',
    files: [{ src: 'index.md', dest: `${name}.md` }],
  };

  const res = await fetch(`${REGISTRY_URL}/api/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, files: { 'index.md': `# ${name}` } }),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to publish fixture ${name}@${version}: ${res.status}`);
  }
}

export function initBareGitRegistry(): { barePath: string; tmpRoot: string } {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-git-e2e-root-'));
  const barePath = path.join(tmpRoot, 'registry.git');
  const workPath = path.join(tmpRoot, 'work');

  runGit(['init', '--bare', barePath], tmpRoot);
  runGit(['init', workPath], tmpRoot);
  runGit(['config', 'user.email', 'e2e@test.com'], workPath);
  runGit(['config', 'user.name', 'e2e'], workPath);
  fs.mkdirSync(path.join(workPath, 'registry'), { recursive: true });
  fs.writeFileSync(path.join(workPath, 'registry', '.gitkeep'), '\n', 'utf8');
  runGit(['add', '.'], workPath);
  runGit(['commit', '-m', 'init git registry'], workPath);
  runGit(['branch', '-M', 'main'], workPath);
  runGit(['remote', 'add', 'origin', barePath], workPath);
  runGit(['push', '-u', 'origin', 'main'], workPath);

  return { barePath, tmpRoot };
}

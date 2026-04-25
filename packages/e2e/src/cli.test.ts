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
 * CLI e2e tests.
 *
 * Exercises the `ai-tools` binary against the live registry.
 *
 * In docker-compose the env var AI_TOOLS_CLI is set to
 *   "node /app/packages/cli/dist/cli.js"
 * so the binary doesn't need to be globally installed.
 *
 * Locally, ensure the CLI is built (`npm run build -w @ai-tools/cli`) and
 * either installed globally or set AI_TOOLS_CLI accordingly.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REGISTRY_URL = (process.env['REGISTRY_URL'] ?? 'http://localhost:4873').replace(/\/$/, '');

/** The CLI invocation — supports overriding with AI_TOOLS_CLI env var. */
const CLI = process.env['AI_TOOLS_CLI'] ?? 'aitools';

function run(args: string, cwd?: string): string {
  return execSync(`${CLI} ${args}`, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
    // Let the test time out if the child hangs; execSync default is inherited
  }).trim();
}

/** Publish a minimal tool fixture to the registry over HTTP so CLI tests can find it. */
async function publishFixture(name: string, version: string): Promise<void> {
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

// ---------------------------------------------------------------------------

describe('aitools --version', () => {
  it('prints a semver version string', () => {
    const out = run('--version');
    expect(out).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ---------------------------------------------------------------------------

describe('aitools search', () => {
  const fixtureName = 'cli-e2e-search-fixture';

  beforeAll(async () => {
    await publishFixture(fixtureName, '1.0.0');
  });

  it('finds a tool published to the registry', () => {
    const out = run(`search cli-e2e-search --registry ${REGISTRY_URL}`);
    expect(out).toContain(fixtureName);
  });

  it('reports no results for an unrecognised query', () => {
    const out = run(`search zzz-no-match-xyzzy --registry ${REGISTRY_URL}`);
    // Either "no results" message or empty output — just must not throw
    expect(typeof out).toBe('string');
  });
});

// ---------------------------------------------------------------------------

describe('aitools install', () => {
  const fixtureName = 'cli-e2e-install-fixture';
  let tmpDir: string;

  beforeAll(async () => {
    await publishFixture(fixtureName, '1.0.0');
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
    // Write a minimal project config pointing at our test registry
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.config.json'),
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('installs a tool from the registry into a project directory', () => {
    run(`install ${fixtureName} --scope project`, tmpDir);
    // The lock file should record the installed tool
    const lockPath = path.join(tmpDir, 'ai-tools-lock.json');
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as {
      tools: Record<string, unknown>;
    };
    expect(lock.tools).toHaveProperty(fixtureName);
  });

  it('exits non-zero when the tool does not exist in the registry', () => {
    expect(() => {
      run(`install no-such-tool-zzz-xyzzy --scope project`, tmpDir);
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('aitools init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates ai-tools.json with the directory name as project name', () => {
    run('init', tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.json'), 'utf8'),
    ) as { name: string };
    expect(manifest.name).toBe(path.basename(tmpDir));
  });

  it('does not overwrite an existing ai-tools.json without --force', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.json'),
      JSON.stringify({ name: 'original', tools: {} }),
    );
    run('init', tmpDir);
    const content = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.json'), 'utf8'),
    ) as { name: string };
    expect(content.name).toBe('original');
  });

  it('overwrites an existing ai-tools.json with --force', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.json'),
      JSON.stringify({ name: 'original', tools: {} }),
    );
    run('init --force', tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.json'), 'utf8'),
    ) as { name: string };
    expect(manifest.name).toBe(path.basename(tmpDir));
  });
});

// ---------------------------------------------------------------------------

describe('aitools list', () => {
  const fixtureName = 'cli-e2e-list-fixture';
  let tmpDir: string;

  beforeAll(async () => {
    await publishFixture(fixtureName, '1.0.0');
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.config.json'),
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('reports no tools when nothing is installed', () => {
    const out = run('list', tmpDir);
    expect(out).toMatch(/no tools/i);
  });

  it('shows the installed tool name after install', () => {
    run(`install ${fixtureName} --scope project`, tmpDir);
    const out = run('list', tmpDir);
    expect(out).toContain(fixtureName);
  });

  it('--json outputs valid JSON with a tools property containing the installed tool', () => {
    run(`install ${fixtureName} --scope project`, tmpDir);
    const out = run('list --json', tmpDir);
    const parsed = JSON.parse(out) as { tools: Record<string, unknown> };
    expect(parsed.tools).toHaveProperty(fixtureName);
  });
});

// ---------------------------------------------------------------------------

describe('aitools uninstall', () => {
  const fixtureName = 'cli-e2e-uninstall-fixture';
  let tmpDir: string;

  beforeAll(async () => {
    await publishFixture(fixtureName, '1.0.0');
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.config.json'),
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('removes the tool from the lock file', () => {
    run(`install ${fixtureName} --scope project`, tmpDir);

    const before = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools-lock.json'), 'utf8'),
    ) as { tools: Record<string, unknown> };
    expect(before.tools).toHaveProperty(fixtureName);

    run(`uninstall ${fixtureName}`, tmpDir);

    const after = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools-lock.json'), 'utf8'),
    ) as { tools: Record<string, unknown> };
    expect(after.tools).not.toHaveProperty(fixtureName);
  });

  it('exits non-zero when the tool is not installed', () => {
    expect(() => {
      run('uninstall not-installed-tool-zzz', tmpDir);
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('aitools update', () => {
  const fixtureName = 'cli-e2e-update-fixture';
  let tmpDir: string;

  beforeAll(async () => {
    await publishFixture(fixtureName, '1.0.0');
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.config.json'),
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('exits non-zero when ai-tools.json is missing', () => {
    expect(() => {
      run('update', tmpDir);
    }).toThrow();
  });

  it('updates the tool to the latest available version', async () => {
    // Install v1.0.0 (the only version so far)
    run(`install ${fixtureName} --scope project`, tmpDir);
    const beforeLock = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { version: string }> };
    expect(beforeLock.tools[`${fixtureName}`]?.version).toBe('1.0.0');

    // Publish v1.1.0 so update has something newer to fetch within ^1.0.0
    await publishFixture(fixtureName, '1.1.0');

    // Create ai-tools.json so update knows what to target
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.json'),
      JSON.stringify({
        name: 'test-project',
        tools: { [`${fixtureName}`]: '^1.0.0' },
        devTools: {},
      }),
    );

    run(`update ${fixtureName}`, tmpDir);

    const afterLock = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { version: string }> };
    expect(afterLock.tools[`${fixtureName}`]?.version).toBe('1.1.0');
  });
});

// ---------------------------------------------------------------------------

describe('aitools manifest bump', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  function writeManifest(version: string): void {
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.manifest.json'),
      JSON.stringify({
        name: 'bump-test',
        version,
        description: 'bump test',
        category: 'skill',
        files: [{ src: 'index.md', dest: 'bump-test.md' }],
      }),
    );
  }

  function readVersion(): string {
    const m = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.manifest.json'), 'utf8'),
    ) as { version: string };
    return m.version;
  }

  it('bumps patch version', () => {
    writeManifest('1.0.0');
    run('manifest bump patch', tmpDir);
    expect(readVersion()).toBe('1.0.1');
  });

  it('bumps minor version', () => {
    writeManifest('1.0.0');
    run('manifest bump minor', tmpDir);
    expect(readVersion()).toBe('1.1.0');
  });

  it('bumps major version', () => {
    writeManifest('1.0.0');
    run('manifest bump major', tmpDir);
    expect(readVersion()).toBe('2.0.0');
  });

  it('sets an explicit version', () => {
    writeManifest('1.0.0');
    run('manifest bump 3.2.1', tmpDir);
    expect(readVersion()).toBe('3.2.1');
  });

  it('exits non-zero when no manifest exists', () => {
    expect(() => run('manifest bump patch', tmpDir)).toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('aitools manifest validate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('succeeds for a valid manifest with all source files present', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.manifest.json'),
      JSON.stringify({
        name: 'validate-test',
        version: '1.0.0',
        description: 'validate test',
        category: 'skill',
        files: [{ src: 'index.md', dest: 'validate-test.md' }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'index.md'), '# validate test');
    const out = run('manifest validate', tmpDir);
    expect(out).toContain('Schema valid');
  });

  it('exits non-zero when a declared source file is missing from disk', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.manifest.json'),
      JSON.stringify({
        name: 'validate-test',
        version: '1.0.0',
        description: 'validate test',
        category: 'skill',
        files: [{ src: 'missing.md', dest: 'validate-test.md' }],
      }),
    );
    // missing.md intentionally not written
    expect(() => run('manifest validate', tmpDir)).toThrow();
  });

  it('exits non-zero when no manifest file exists', () => {
    expect(() => run('manifest validate', tmpDir)).toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('aitools publish', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('--dry-run shows what would be published without uploading', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.manifest.json'),
      JSON.stringify({
        name: 'cli-e2e-dry-run-tool',
        version: '1.0.0',
        description: 'dry run test',
        category: 'skill',
        files: [{ src: 'index.md', dest: 'cli-e2e-dry-run-tool.md' }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'index.md'), '# dry run');
    const out = run(`publish --dry-run --registry ${REGISTRY_URL}`, tmpDir);
    expect(out).toContain('Would publish');
  });

  it('publishes a tool to the registry', async () => {
    const toolName = 'cli-e2e-publish-via-cli';
    fs.writeFileSync(
      path.join(tmpDir, 'ai-tools.manifest.json'),
      JSON.stringify({
        name: toolName,
        version: '1.0.0',
        description: 'CLI publish e2e test',
        category: 'skill',
        files: [{ src: 'index.md', dest: `${toolName}.md` }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'index.md'), `# ${toolName}`);

    run(`publish --registry ${REGISTRY_URL}`, tmpDir);

    // Verify it landed in the registry
    const res = await fetch(`${REGISTRY_URL}/api/tools/${toolName}`);
    expect(res.status).toBe(200);
    const manifest = await res.json() as { name: string; version: string };
    expect(manifest.name).toBe(toolName);
    expect(manifest.version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------

describe('aitools registry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('adds a registry to the project config', () => {
    run('registry add http://registry.example.com --name my-reg', tmpDir);
    const cfg = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.config.json'), 'utf8'),
    ) as { registries: Array<{ name: string; url: string }> };
    expect(cfg.registries.some((r) => r.name === 'my-reg')).toBe(true);
  });

  it('lists configured registries', () => {
    run('registry add http://registry.example.com --name my-reg', tmpDir);
    const out = run('registry list', tmpDir);
    expect(out).toContain('my-reg');
  });

  it('removes a registry from the project config', () => {
    run('registry add http://registry.example.com --name my-reg', tmpDir);
    run('registry remove my-reg', tmpDir);
    const cfg = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.config.json'), 'utf8'),
    ) as { registries: Array<{ name: string }> };
    expect(cfg.registries.some((r) => r.name === 'my-reg')).toBe(false);
  });

  it('sets priority on the added registry', () => {
    run('registry add http://registry.example.com --name prio-reg --priority 5', tmpDir);
    const cfg = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.config.json'), 'utf8'),
    ) as { registries: Array<{ name: string; priority?: number }> };
    const reg = cfg.registries.find((r) => r.name === 'prio-reg');
    expect(reg?.priority).toBe(5);
  });
});

// ---------------------------------------------------------------------------

describe('aitools config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('sets a scalar config key and writes it to project config', () => {
    run('config set platform vscode', tmpDir);
    const cfg = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'ai-tools.config.json'), 'utf8'),
    ) as { platform?: string };
    expect(cfg.platform).toBe('vscode');
  });

  it('gets a previously set config value', () => {
    run('config set platform claude', tmpDir);
    const out = run('config get platform', tmpDir);
    expect(out.trim()).toBe('claude');
  });

  it('reports not-set for a missing key', () => {
    const out = run('config get platform', tmpDir);
    expect(out).toContain('not set');
  });

  it('unsets a config key', () => {
    run('config set platform vscode', tmpDir);
    run('config unset platform', tmpDir);
    const out = run('config get platform', tmpDir);
    expect(out).toContain('not set');
  });

  it('exits non-zero for an invalid platform value', () => {
    expect(() => run('config set platform invalid-ide', tmpDir)).toThrow();
  });
});

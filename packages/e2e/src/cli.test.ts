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
/**
 * CLI e2e tests.
 *
 * Exercises the `aitools` binary against the live registry.
 *
 * In docker-compose the env var AITOOLS_CLI is set to
 *   "node /app/packages/cli/dist/cli.js"
 * so the binary doesn't need to be globally installed.
 *
 * Locally, ensure the CLI is built (`npm run build -w @bitgenetics/aitools-cli`) and
 * either installed globally or set AITOOLS_CLI accordingly.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  E2E_HOME,
  E2E_USER_CONFIG,
  REGISTRY_URL,
  clearE2eUserConfig,
  getGitRegistryRemote,
  gitCacheDirFor,
  initGitRegistry,
  makeE2eProjectDir,
  publishFixture,
  rmTmpDir,
  run,
} from './test-env.js';

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
    // Either "no results" message or empty output ? just must not throw
    expect(typeof out).toBe('string');
  });
});

// ---------------------------------------------------------------------------

describe('aitools install', () => {
  const fixtureName = 'cli-e2e-install-fixture';
  const nestPluginName = 'cli-e2e-bundle-nest-plugin';
  const nestPluginVersion = '1.0.0';
  let tmpDir: string;

  beforeAll(async () => {
    await publishFixture(fixtureName, '1.0.0');
    const res = await fetch(`${REGISTRY_URL}/api/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manifest: {
          name: nestPluginName,
          version: nestPluginVersion,
          description: 'Plugin for --plugin-bundle nest e2e',
          category: 'plugin',
          nativeFor: 'cursor',
          author: 'e2e',
          files: [
            { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
            {
              src: `skills/${nestPluginName}/SKILL.md`,
              dest: `skills/${nestPluginName}/SKILL.md`,
              placementMode: 'transform',
            },
            { src: 'skills/x/SKILL.md', dest: 'skills/x/SKILL.md', placementMode: 'transform' },
          ],
        },
        files: {
          '.cursor-plugin/plugin.json': JSON.stringify({ name: nestPluginName }),
          [`skills/${nestPluginName}/SKILL.md`]: '# Nest Hub\n',
          'skills/x/SKILL.md': '# X\n',
        },
      }),
    });
    if (!res.ok && res.status !== 409) {
      throw new Error(`Failed to publish nest plugin: ${res.status} ${await res.text()}`);
    }
  });

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-e2e-');
    clearE2eUserConfig();
    // Registry lives in user config by default
    fs.writeFileSync(
      E2E_USER_CONFIG,
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('installs a tool from the registry', () => {
    run(`install ${fixtureName}`, tmpDir);
    const lockPath = path.join(tmpDir, 'aitools-lock.json');
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as {
      tools: Record<string, unknown>;
    };
    expect(lock.tools).toHaveProperty(fixtureName);
  });

  it('installs into plugin author layout with --plugin-bundle', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        platform: 'cursor',
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
    run(`install ${fixtureName} --plugin-bundle --platform cursor`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'skills', `${fixtureName}.md`))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', `${fixtureName}.md`))).toBe(false);

    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, 'aitools-lock.json'), 'utf8')) as {
      tools: Record<string, { installMethod?: string }>;
    };
    expect(lock.tools[fixtureName]?.installMethod).toBe('plugin-bundle');

    run(`uninstall ${fixtureName}`, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'skills', `${fixtureName}.md`))).toBe(false);
  });

  it('rejects --plugin-bundle with --global', () => {
    expect(() => {
      run(`install ${fixtureName} --plugin-bundle --global`, tmpDir);
    }).toThrow();
  });

  it('rejects combining --plugin-bundle and --cursor-plugin', () => {
    expect(() => {
      run(`install ${fixtureName} --plugin-bundle --cursor-plugin`, tmpDir);
    }).toThrow();
  });

  it('nests a plugin into author layout with --plugin-bundle and syncs files[]', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        platform: 'cursor',
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
    fs.mkdirSync(path.join(tmpDir, '.cursor-plugin'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.cursor-plugin', 'plugin.json'), '{"name":"host"}', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({
        name: 'host',
        version: '1.0.0',
        description: 'Host plugin',
        category: 'plugin',
        nativeFor: 'cursor',
        files: [{ src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' }],
      }),
      'utf8',
    );

    run(`install ${nestPluginName}@${nestPluginVersion} --plugin-bundle --platform cursor`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'skills', nestPluginName, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'skills', 'x', 'SKILL.md'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(tmpDir, '.cursor-plugin', 'plugin.json'), 'utf8'))).toEqual({
      name: 'host',
    });

    const host = JSON.parse(fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8')) as {
      files: Array<{ src: string }>;
    };
    expect(host.files.some((f) => f.src === `skills/${nestPluginName}/SKILL.md`)).toBe(true);

    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, 'aitools-lock.json'), 'utf8')) as {
      tools: Record<string, { installMethod?: string }>;
    };
    expect(lock.tools[nestPluginName]?.installMethod).toBe('plugin-bundle');

    run(`uninstall ${nestPluginName}`, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'skills', nestPluginName, 'SKILL.md'))).toBe(false);
    const hostAfter = JSON.parse(fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8')) as {
      files: Array<{ src: string }>;
    };
    expect(hostAfter.files.some((f) => f.src === `skills/${nestPluginName}/SKILL.md`)).toBe(false);
  });

  it('fails --plugin-bundle nest on collision', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        platform: 'cursor',
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
    fs.mkdirSync(path.join(tmpDir, 'skills', 'x'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'skills', 'x', 'SKILL.md'), '# keep\n', 'utf8');

    expect(() => {
      run(`install ${nestPluginName}@${nestPluginVersion} --plugin-bundle --platform cursor`, tmpDir);
    }).toThrow(/collision/);

    expect(fs.readFileSync(path.join(tmpDir, 'skills', 'x', 'SKILL.md'), 'utf8')).toBe('# keep\n');
  });

  it('default install still uses platform skill dirs (not skills/)', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        platform: 'cursor',
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
    run(`install ${fixtureName} --platform cursor`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', `${fixtureName}.md`))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'skills', `${fixtureName}.md`))).toBe(false);
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
    tmpDir = makeE2eProjectDir('aitools-e2e-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('creates aitools.json with the directory name as project name', () => {
    run('init', tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { name: string };
    expect(manifest.name).toBe(path.basename(tmpDir));
  });

  it('does not overwrite an existing aitools.json without --force', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({ name: 'original', dependencies: {} }),
    );
    run('init', tmpDir);
    const content = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { name: string };
    expect(content.name).toBe('original');
  });

  it('overwrites an existing aitools.json with --force', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({ name: 'original', dependencies: {} }),
    );
    run('init --force', tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { name: string };
    expect(manifest.name).toBe(path.basename(tmpDir));
  });
});

// ---------------------------------------------------------------------------

describe('aitools list', () => {
  const fixtureName = 'cli-e2e-list-fixture';
  const pluginName = 'cli-e2e-list-plugin';
  const pluginVersion = '1.0.0';
  let tmpDir: string;

  beforeAll(async () => {
    await publishFixture(fixtureName, '1.0.0');
    const res = await fetch(`${REGISTRY_URL}/api/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manifest: {
          name: pluginName,
          version: pluginVersion,
          description: 'List e2e plugin',
          category: 'plugin',
          nativeFor: 'cursor',
          author: 'e2e',
          files: [
            { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
            { src: 'skills/x/SKILL.md', dest: 'skills/x/SKILL.md', placementMode: 'transform' },
          ],
        },
        files: {
          '.cursor-plugin/plugin.json': JSON.stringify({ name: pluginName }),
          'skills/x/SKILL.md': '# X\n',
        },
      }),
    });
    if (!res.ok && res.status !== 409) {
      throw new Error(`Failed to publish list plugin: ${res.status} ${await res.text()}`);
    }
  });

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-e2e-');
    clearE2eUserConfig();
    fs.writeFileSync(
      E2E_USER_CONFIG,
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
    clearE2eUserConfig();
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

  it('lists user-scope tools with -g from ~/.aitools tracking', () => {
    run(`install ${fixtureName} --global`, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'aitools-lock.json'))).toBe(false);
    const out = run('list -g', tmpDir);
    expect(out).toContain(fixtureName);
  });

  it('marks cursor-plugin installs with [cursor-plugin] on list -g', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        platform: 'cursor',
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
    run(`install ${pluginName}@${pluginVersion} --cursor-plugin`, tmpDir);
    const out = run('list -g', tmpDir);
    expect(out).toContain(pluginName);
    expect(out).toContain('[cursor-plugin]');
  });

  it('marks plugin-bundle installs with [plugin-bundle] on list', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        platform: 'cursor',
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
    run(`install ${fixtureName} --plugin-bundle --platform cursor`, tmpDir);
    const out = run('list', tmpDir);
    expect(out).toContain(fixtureName);
    expect(out).toContain('[plugin-bundle]');
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
    tmpDir = makeE2eProjectDir('aitools-e2e-');
    clearE2eUserConfig();
    fs.writeFileSync(
      E2E_USER_CONFIG,
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
    clearE2eUserConfig();
  });

  it('removes the tool from the lock file', () => {
    run(`install ${fixtureName} --scope project`, tmpDir);

    const before = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools-lock.json'), 'utf8'),
    ) as { tools: Record<string, unknown> };
    expect(before.tools).toHaveProperty(fixtureName);

    run(`uninstall ${fixtureName}`, tmpDir);

    const after = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools-lock.json'), 'utf8'),
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
    tmpDir = makeE2eProjectDir('aitools-e2e-');
    clearE2eUserConfig();
    fs.writeFileSync(
      E2E_USER_CONFIG,
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
    clearE2eUserConfig();
  });

  it('exits non-zero when aitools.json is missing', () => {
    expect(() => {
      run('update', tmpDir);
    }).toThrow();
  });

  it('updates the tool to the latest available version', async () => {
    // Install v1.0.0 (the only version so far)
    run(`install ${fixtureName} --scope project`, tmpDir);
    const beforeLock = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { version: string }> };
    expect(beforeLock.tools[`${fixtureName}`]?.version).toBe('1.0.0');

    // Publish v1.1.0 so update has something newer to fetch within ^1.0.0
    await publishFixture(fixtureName, '1.1.0');

    // Create aitools.json so update knows what to target
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: { [`${fixtureName}`]: '^1.0.0' },
        devDependencies: {},
      }),
    );

    run(`update ${fixtureName}`, tmpDir);

    const afterLock = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { version: string }> };
    expect(afterLock.tools[`${fixtureName}`]?.version).toBe('1.1.0');
  });
});

// ---------------------------------------------------------------------------

describe('aitools manifest bump', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-e2e-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  function writeManifest(version: string): void {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
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
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
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

describe('aitools version', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-e2e-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  function writeManifest(version: string): void {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({
        name: 'version-test',
        version,
        description: 'version test',
        category: 'skill',
        files: [{ src: 'index.md', dest: 'version-test.md' }],
      }),
    );
  }

  function readVersion(): string {
    const m = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { version: string };
    return m.version;
  }

  it('prints the current version', () => {
    writeManifest('1.2.3');
    const out = run('version', tmpDir);
    expect(out.trim()).toBe('1.2.3');
  });

  it('bumps patch version', () => {
    writeManifest('1.0.0');
    run('version patch', tmpDir);
    expect(readVersion()).toBe('1.0.1');
  });

  it('bumps minor version', () => {
    writeManifest('1.0.0');
    run('version minor', tmpDir);
    expect(readVersion()).toBe('1.1.0');
  });

  it('bumps major version', () => {
    writeManifest('1.0.0');
    run('version major', tmpDir);
    expect(readVersion()).toBe('2.0.0');
  });

  it('sets an explicit version', () => {
    writeManifest('1.0.0');
    run('version 3.2.1', tmpDir);
    expect(readVersion()).toBe('3.2.1');
  });

  it('exits non-zero when no manifest exists', () => {
    expect(() => run('version patch', tmpDir)).toThrow();
  });
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

describe('aitools manifest init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-e2e-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('nests skill dest under the package name for a root SKILL.md', () => {
    fs.writeFileSync(path.join(tmpDir, 'SKILL.md'), '# E2E skill\n');
    run('manifest init --name e2e-init-skill --category skill --yes --force', tmpDir);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { files: Array<{ src: string; dest: string; placementMode?: string }> };
    expect(manifest.files).toEqual([
      { src: 'SKILL.md', dest: 'e2e-init-skill/SKILL.md', placementMode: 'strict' },
    ]);
  });

  it('nests skill dest under the package name when content lives in a subfolder', () => {
    fs.mkdirSync(path.join(tmpDir, 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'my-skill', 'SKILL.md'), '# Nested\n');
    run('manifest init --name e2e-nested-skill --category skill --yes --force', tmpDir);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { files: Array<{ src: string; dest: string; placementMode?: string }> };
    expect(manifest.files).toEqual([
      { src: 'my-skill/SKILL.md', dest: 'e2e-nested-skill/my-skill/SKILL.md', placementMode: 'strict' },
    ]);
  });

  it('uses a nested SKILL.md placeholder when no content files exist', () => {
    run('manifest init --name e2e-placeholder --category skill --yes --force', tmpDir);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { files: Array<{ src: string; dest: string; placementMode?: string }> };
    expect(manifest.files).toEqual([
      { src: 'e2e-placeholder/SKILL.md', dest: 'e2e-placeholder/SKILL.md', placementMode: 'strict' },
    ]);
  });

  it('keeps mcp-tool dest as the author-relative path', () => {
    fs.writeFileSync(path.join(tmpDir, 'server.js'), 'export {}\n');
    run('manifest init --name e2e-mcp --category mcp-tool --yes --force', tmpDir);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { files: Array<{ src: string; dest: string; placementMode?: string }> };
    expect(manifest.files).toEqual([
      { src: 'server.js', dest: 'server.js', placementMode: 'strict' },
    ]);
  });
});

// ---------------------------------------------------------------------------

describe('aitools manifest files', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-e2e-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('--yes --force nests skill dest under the package name', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({
        name: 'e2e-files-skill',
        version: '1.0.0',
        description: 'files dest test',
        category: 'skill',
        files: [{ src: 'skill.md', dest: 'skill.md' }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'skill.md'), '# Skill\n');
    run('manifest files --yes --force', tmpDir);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'aitools.json'), 'utf8'),
    ) as { files: Array<{ src: string; dest: string; placementMode?: string }> };
    expect(manifest.files).toEqual([
      { src: 'skill.md', dest: 'e2e-files-skill/skill.md', placementMode: 'strict' },
    ]);
  });
});

// ---------------------------------------------------------------------------

describe('aitools manifest validate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-e2e-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('succeeds for a valid manifest with all source files present', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
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
      path.join(tmpDir, 'aitools.json'),
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
    tmpDir = makeE2eProjectDir('aitools-e2e-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('--dry-run shows what would be published without uploading', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
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
      path.join(tmpDir, 'aitools.json'),
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

  it('rejects legacy aitools.manifest.json as the publish source', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.manifest.json'),
      JSON.stringify({
        name: 'cli-e2e-legacy-manifest',
        version: '1.0.0',
        description: 'legacy only',
        category: 'skill',
        files: [{ src: 'index.md', dest: 'legacy.md' }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'index.md'), '# legacy');

    expect(() => run(`publish --dry-run --registry ${REGISTRY_URL}`, tmpDir)).toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('aitools git registry', () => {
  const fixtureName = 'cli-e2e-git-fixture';
  let gitRegName: string;
  let gitRegistryUrl: string;
  let gitRoot: string | null;
  let tmpDir: string;
  let usingGitea = false;

  beforeAll(() => {
    const gitRegistry = initGitRegistry();
    gitRegistryUrl = gitRegistry.url;
    gitRoot = gitRegistry.tmpRoot;
    gitRegName = gitRegistry.name;
    usingGitea = getGitRegistryRemote()?.provider === 'gitea';
  });

  afterAll(() => {
    const cache = gitCacheDirFor(gitRegName);
    if (fs.existsSync(cache)) {
      fs.rmSync(cache, { recursive: true, force: true });
    }
    if (gitRoot && fs.existsSync(gitRoot)) {
      fs.rmSync(gitRoot, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-git-e2e-');
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        registries: [
          {
            type: 'git',
            name: gitRegName,
            url: gitRegistryUrl,
            readBranch: 'main',
            publishBranch: 'main',
            path: 'registry/',
            priority: 1,
          },
        ],
      }),
    );
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('publishes and installs a tool through a git registry', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({
        name: fixtureName,
        version: '1.0.0',
        description: 'Git registry e2e fixture',
        category: 'skill',
        files: [{ src: 'index.md', dest: `${fixtureName}.md` }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'index.md'), `# ${fixtureName}`);

    run('publish', tmpDir);
    run(`install ${fixtureName} --scope project`, tmpDir);

    const lockPath = path.join(tmpDir, 'aitools-lock.json');
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as {
      tools: Record<string, unknown>;
    };
    expect(lock.tools).toHaveProperty(fixtureName);
  });

  it('finds a published tool via search', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({
        name: `${fixtureName}-search`,
        version: '1.0.0',
        description: 'Git registry search fixture',
        category: 'skill',
        files: [{ src: 'index.md', dest: `${fixtureName}-search.md` }],
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'index.md'), '# search fixture');

    run('publish', tmpDir);
    const out = run(`search ${fixtureName}-search`, tmpDir);
    expect(out).toContain(`${fixtureName}-search`);
  });

  it('adds a git registry via registry add to user config', () => {
    const regDir = makeE2eProjectDir('aitools-git-reg-add-');
    clearE2eUserConfig();
    try {
      run(
        `registry add "${gitRegistryUrl.replace(/\\/g, '/')}" --name git-added --type git --read-branch main --publish-branch main --path registry/`,
        regDir,
      );
      const cfg = JSON.parse(fs.readFileSync(E2E_USER_CONFIG, 'utf8')) as {
        registries: Array<{ type: string; name: string; url: string }>;
      };
      const added = cfg.registries.find((r) => r.name === 'git-added');
      expect(added?.type).toBe('git');
      if (usingGitea) {
        expect(added?.url).toContain('tools-registry');
      } else {
        expect(added?.url).toContain('registry.git');
      }
    } finally {
      fs.rmSync(regDir, { recursive: true, force: true });
    }
  });
});

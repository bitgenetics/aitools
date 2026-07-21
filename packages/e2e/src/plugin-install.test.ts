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
 * Plugin category install e2e — explode into platform paths, not opaque plugin roots.
 *
 * Changelog contracts: features → plugin category, placementMode; constraints → plugin install dirs,
 * user-scope tracking, platform user MCP paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import { E2E_HOME, REGISTRY_URL, makeE2eProjectDir, rmTmpDir, run } from './test-env.js';

const PLUGIN_NAME = 'e2e-test-plugin';
const PLUGIN_VERSION = '1.2.0';
const MCP_PATH_PLUGIN = 'e2e-mcp-path-plugin';
const MCP_PATH_VERSION = '1.0.0';
const STRICT_PLUGIN = 'e2e-strict-placement-plugin';
const STRICT_VERSION = '1.0.0';
const NATIVE_PLUGIN = 'e2e-native-members-plugin';
const NATIVE_VERSION = '1.0.0';
const MCP_SERVER_KEY = 'plugin-db';

/** VS Code user MCP under isolated E2E_HOME (matches resolveVsCodeUserMcpConfig + pinned APPDATA). */
function e2eVsCodeUserMcpPath(): string {
  if (process.platform === 'win32') {
    return path.join(E2E_HOME, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json');
  }
  if (process.platform === 'darwin') {
    return path.join(E2E_HOME, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
  }
  return path.join(E2E_HOME, '.config', 'Code', 'User', 'mcp.json');
}

function writeProjectConfig(tmpDir: string, platform: string): void {
  fs.writeFileSync(
    path.join(tmpDir, 'aitools.config.json'),
    JSON.stringify({
      platform,
      registries: [{ name: 'e2e', url: REGISTRY_URL, priority: 1 }],
    }),
  );
}

function readMcpServers(mcpPath: string): Record<string, unknown> {
  const raw = JSON.parse(fs.readFileSync(mcpPath, 'utf8')) as Record<string, unknown>;
  return (
    (raw['servers'] as Record<string, unknown> | undefined) ??
    (raw['mcpServers'] as Record<string, unknown> | undefined) ??
    {}
  );
}

async function publishPlugin(
  manifest: Record<string, unknown>,
  files: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${REGISTRY_URL}/api/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, files }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to publish ${String(manifest['name'])}: ${res.status} ${await res.text()}`);
  }
}

beforeAll(async () => {
  await publishPlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description: 'E2E plugin fixture',
      category: 'plugin',
      nativeFor: 'cursor',
      author: 'e2e',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/review/SKILL.md', dest: 'skills/review/SKILL.md', placementMode: 'transform' },
        { src: 'rules/style.mdc', dest: 'rules/style.mdc', placementMode: 'transform' },
        { src: 'scripts/fmt.sh', dest: 'scripts/fmt.sh', placementMode: 'transform' },
        { src: 'hooks/hooks.json', dest: 'hooks/hooks.json' },
        { src: 'mcp.json', dest: 'mcp.json' },
      ],
    },
    {
      '.cursor-plugin/plugin.json': JSON.stringify({ name: PLUGIN_NAME }),
      'skills/review/SKILL.md': '# Review\nE2E plugin skill.',
      'rules/style.mdc': '---\ndescription: style\nalwaysApply: true\n---\nBe tidy.\n',
      'scripts/fmt.sh': '#!/bin/sh\necho fmt\n',
      'hooks/hooks.json': JSON.stringify({
        hooks: { afterFileEdit: [{ command: './scripts/fmt.sh' }] },
      }),
      'mcp.json': JSON.stringify({
        mcpServers: { [MCP_SERVER_KEY]: { command: 'npx', args: ['-y', 'server'] } },
      }),
    },
  );

  // Lean universal plugin for cross-platform user MCP path tests (no hooks/rules → no transform annotations).
  await publishPlugin(
    {
      name: MCP_PATH_PLUGIN,
      version: MCP_PATH_VERSION,
      description: 'E2E MCP path fixture',
      category: 'plugin',
      nativeFor: 'universal',
      author: 'e2e',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/mcp-skill/SKILL.md', dest: 'skills/mcp-skill/SKILL.md', placementMode: 'transform' },
        { src: 'mcp.json', dest: 'mcp.json' },
      ],
    },
    {
      '.cursor-plugin/plugin.json': JSON.stringify({ name: MCP_PATH_PLUGIN }),
      'skills/mcp-skill/SKILL.md': '# MCP skill\n',
      'mcp.json': JSON.stringify({
        mcpServers: { [MCP_SERVER_KEY]: { command: 'npx', args: ['-y', 'server'] } },
      }),
    },
  );

  // Strict placement: omitted placementMode + project-relative dest (no synthetic-skill remap).
  await publishPlugin(
    {
      name: STRICT_PLUGIN,
      version: STRICT_VERSION,
      description: 'E2E strict placement fixture',
      category: 'plugin',
      nativeFor: 'cursor',
      author: 'e2e',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'skills/x/SKILL.md', dest: 'skills/x/SKILL.md', placementMode: 'transform' },
        { src: 'assets/someref.md', dest: '.cursor/assets/someref.md', placementMode: 'verbatim' },
      ],
    },
    {
      '.cursor-plugin/plugin.json': JSON.stringify({ name: STRICT_PLUGIN }),
      'skills/x/SKILL.md': '# X\n',
      'assets/someref.md': 'ref\n',
    },
  );

  // Native members (skills/rules/agents) with omitted placementMode — the shape `manifest init`
  // emits for plugins. Must explode into platform dirs for both scopes, never the cwd.
  await publishPlugin(
    {
      name: NATIVE_PLUGIN,
      version: NATIVE_VERSION,
      description: 'E2E native-members fixture',
      category: 'plugin',
      nativeFor: 'cursor',
      author: 'e2e',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: 'agents/researcher.md', dest: 'agents/researcher.md' },
        { src: 'skills/native-x/SKILL.md', dest: 'skills/native-x/SKILL.md' },
        { src: 'rules/native-style.mdc', dest: 'rules/native-style.mdc' },
      ],
    },
    {
      '.cursor-plugin/plugin.json': JSON.stringify({ name: NATIVE_PLUGIN }),
      'agents/researcher.md': '# Researcher\n',
      'skills/native-x/SKILL.md': '# Native X\n',
      'rules/native-style.mdc': '---\ndescription: style\nalwaysApply: true\n---\nBe tidy.\n',
    },
  );
});

describe('plugin explode install', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-plugin-e2e-');
    writeProjectConfig(tmpDir, 'cursor');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('installs elements into cursor skill/rule dirs and rewrites hook paths', () => {
    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --scope project`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', 'review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'style.mdc'))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, '.cursor', 'skills', PLUGIN_NAME, 'scripts', 'fmt.sh')),
    ).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.agents', 'plugins', PLUGIN_NAME))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'plugins', 'local', PLUGIN_NAME))).toBe(false);

    const hooks = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), 'utf8'),
    ) as { afterFileEdit: Array<{ command: string }> };
    expect(hooks.afterFileEdit[0]!.command).toContain(
      `.cursor/skills/${PLUGIN_NAME}/scripts/fmt.sh`,
    );
  });

  it('honors verbatim placementMode as scope-relative dest for assets', () => {
    run(`install ${STRICT_PLUGIN}@${STRICT_VERSION} --scope project`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'assets', 'someref.md'))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, '.cursor', 'skills', STRICT_PLUGIN, 'assets', 'someref.md')),
    ).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', 'x', 'SKILL.md'))).toBe(true);
  });

  it('explodes native members (omitted placementMode) into project platform dirs, not the cwd', () => {
    run(`install ${NATIVE_PLUGIN}@${NATIVE_VERSION} --scope project`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'agents', 'researcher.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', 'native-x', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'native-style.mdc'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'agents', 'researcher.md'))).toBe(false);
  });

  it('explodes native members into user platform dirs with --global, never the cwd', () => {
    run(`install ${NATIVE_PLUGIN}@${NATIVE_VERSION} --global`, tmpDir);

    expect(fs.existsSync(path.join(E2E_HOME, '.cursor', 'agents', 'researcher.md'))).toBe(true);
    expect(fs.existsSync(path.join(E2E_HOME, '.cursor', 'skills', 'native-x', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(E2E_HOME, '.cursor', 'rules', 'native-style.mdc'))).toBe(true);

    // The reported bug: files landing in the directory the command was run from.
    expect(fs.existsSync(path.join(tmpDir, 'agents', 'researcher.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'agents', 'researcher.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'aitools-lock.json'))).toBe(false);

    run(`uninstall ${NATIVE_PLUGIN} -g`, tmpDir);
    expect(fs.existsSync(path.join(E2E_HOME, '.cursor', 'agents', 'researcher.md'))).toBe(false);
  });

  it('uninstall removes exploded files and hook handlers', () => {
    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --scope project`, tmpDir);
    run(`uninstall ${PLUGIN_NAME}`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', 'review', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'style.mdc'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', PLUGIN_NAME))).toBe(false);
  });

  it('merges plugin MCP into project mcp.json and records mcpKeys', () => {
    const mcpPath = path.join(tmpDir, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(mcpPath, JSON.stringify({ servers: { keep: { command: 'node' } } }));

    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --scope project`, tmpDir);

    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, 'aitools-lock.json'), 'utf8')) as {
      tools: Record<string, { mcpKeys?: string[] }>;
    };
    expect(lock.tools[PLUGIN_NAME]?.mcpKeys).toEqual([MCP_SERVER_KEY]);

    const servers = readMcpServers(mcpPath);
    expect(servers['keep']).toBeDefined();
    expect(servers[MCP_SERVER_KEY]).toBeDefined();
  });

  it('uninstall removes merged MCP keys and keeps unrelated entries', () => {
    const mcpPath = path.join(tmpDir, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(mcpPath, JSON.stringify({ servers: { keep: { command: 'node' } } }));

    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --scope project`, tmpDir);
    run(`uninstall ${PLUGIN_NAME}`, tmpDir);

    const servers = readMcpServers(mcpPath);
    expect(servers[MCP_SERVER_KEY]).toBeUndefined();
    expect(servers['keep']).toBeDefined();
  });

  it('installs to user skill roots with --global under ~/.aitools tracking', () => {
    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --global`, tmpDir);

    const homeSkills = path.join(E2E_HOME, '.cursor', 'skills', 'review', 'SKILL.md');
    expect(fs.existsSync(homeSkills)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'aitools-lock.json'))).toBe(false);

    const userLockPath = path.join(E2E_HOME, '.aitools', 'aitools-lock.json');
    const lock = JSON.parse(fs.readFileSync(userLockPath, 'utf8')) as {
      tools: Record<string, { scope?: string; files: string[] }>;
    };
    expect(lock.tools[PLUGIN_NAME]?.scope).toBe('user');
    expect(lock.tools[PLUGIN_NAME]?.files.some((f) => f.includes('skills'))).toBe(true);

    run(`uninstall ${PLUGIN_NAME} -g`, tmpDir);
    const lockAfter = JSON.parse(fs.readFileSync(userLockPath, 'utf8')) as {
      tools: Record<string, unknown>;
    };
    expect(lockAfter.tools[PLUGIN_NAME]).toBeUndefined();
    expect(fs.existsSync(homeSkills)).toBe(false);
  });

  it('merges user-scope MCP into ~/.claude.json for platform claude', () => {
    writeProjectConfig(tmpDir, 'claude');
    const claudeMcp = path.join(E2E_HOME, '.claude.json');
    fs.writeFileSync(claudeMcp, JSON.stringify({ mcpServers: { keep: { command: 'node' } } }));

    run(`install ${MCP_PATH_PLUGIN}@${MCP_PATH_VERSION} --global`, tmpDir);

    expect(fs.existsSync(path.join(E2E_HOME, '.claude', 'mcp.json'))).toBe(false);
    const servers = readMcpServers(claudeMcp);
    expect(servers['keep']).toBeDefined();
    expect(servers[MCP_SERVER_KEY]).toBeDefined();

    const userLock = JSON.parse(
      fs.readFileSync(path.join(E2E_HOME, '.aitools', 'aitools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { mcpKeys?: string[] }> };
    expect(userLock.tools[MCP_PATH_PLUGIN]?.mcpKeys).toEqual([MCP_SERVER_KEY]);

    run(`uninstall ${MCP_PATH_PLUGIN} -g`, tmpDir);
    const after = readMcpServers(claudeMcp);
    expect(after[MCP_SERVER_KEY]).toBeUndefined();
    expect(after['keep']).toBeDefined();
  });

  it('merges user-scope MCP into VS Code profile mcp.json', () => {
    writeProjectConfig(tmpDir, 'vscode');
    const vscodeMcp = e2eVsCodeUserMcpPath();
    fs.mkdirSync(path.dirname(vscodeMcp), { recursive: true });
    fs.writeFileSync(vscodeMcp, JSON.stringify({ servers: { keep: { command: 'node' } } }));

    run(`install ${MCP_PATH_PLUGIN}@${MCP_PATH_VERSION} --global`, tmpDir);

    const servers = readMcpServers(vscodeMcp);
    expect(servers['keep']).toBeDefined();
    expect(servers[MCP_SERVER_KEY]).toBeDefined();

    run(`uninstall ${MCP_PATH_PLUGIN} -g`, tmpDir);
    const after = readMcpServers(vscodeMcp);
    expect(after[MCP_SERVER_KEY]).toBeUndefined();
    expect(after['keep']).toBeDefined();
  });

  it('installs full cursor plugin with hooks to claude user scope without throwing', () => {
    writeProjectConfig(tmpDir, 'claude');
    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --global`, tmpDir);

    expect(fs.existsSync(path.join(E2E_HOME, '.claude', 'skills', 'review', 'SKILL.md'))).toBe(true);
    const userLock = JSON.parse(
      fs.readFileSync(path.join(E2E_HOME, '.aitools', 'aitools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { scope?: string }> };
    expect(userLock.tools[PLUGIN_NAME]?.scope).toBe('user');

    run(`uninstall ${PLUGIN_NAME} -g`, tmpDir);
    expect(fs.existsSync(path.join(E2E_HOME, '.claude', 'skills', 'review', 'SKILL.md'))).toBe(false);
  });

  it('installs opaque tree with --cursor-plugin under plugins/local', () => {
    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --cursor-plugin`, tmpDir);

    const localRoot = path.join(E2E_HOME, '.cursor', 'plugins', 'local', PLUGIN_NAME);
    expect(fs.existsSync(path.join(localRoot, '.cursor-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(localRoot, 'skills', 'review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', 'review', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'aitools-lock.json'))).toBe(false);

    const userLock = JSON.parse(
      fs.readFileSync(path.join(E2E_HOME, '.aitools', 'aitools-lock.json'), 'utf8'),
    ) as { tools: Record<string, { installMethod?: string }> };
    expect(userLock.tools[PLUGIN_NAME]?.installMethod).toBe('cursor-plugin-local');

    run(`uninstall ${PLUGIN_NAME} --cursor-plugin`, tmpDir);
    expect(fs.existsSync(localRoot)).toBe(false);
  });

  it('rejects --cursor-plugin with --scope project', () => {
    expect(() =>
      run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --cursor-plugin --scope project`, tmpDir),
    ).toThrow();
  });
});

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
 */

import fs from 'node:fs';
import path from 'node:path';
import { E2E_HOME, REGISTRY_URL, makeE2eProjectDir, rmTmpDir, run } from './test-env.js';

const PLUGIN_NAME = 'e2e-test-plugin';
const PLUGIN_VERSION = '1.1.0';

beforeAll(async () => {
  const manifest = {
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: 'E2E plugin fixture',
    category: 'plugin',
    nativeFor: 'cursor',
    author: 'e2e',
    files: [
      { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
      { src: 'skills/review/SKILL.md', dest: 'skills/review/SKILL.md' },
      { src: 'rules/style.mdc', dest: 'rules/style.mdc' },
      { src: 'scripts/fmt.sh', dest: 'scripts/fmt.sh' },
      { src: 'hooks/hooks.json', dest: 'hooks/hooks.json' },
    ],
  };
  const fileContents = {
    '.cursor-plugin/plugin.json': JSON.stringify({ name: PLUGIN_NAME }),
    'skills/review/SKILL.md': '# Review\nE2E plugin skill.',
    'rules/style.mdc': '---\ndescription: style\nalwaysApply: true\n---\nBe tidy.\n',
    'scripts/fmt.sh': '#!/bin/sh\necho fmt\n',
    'hooks/hooks.json': JSON.stringify({
      hooks: { afterFileEdit: [{ command: './scripts/fmt.sh' }] },
    }),
  };

  const res = await fetch(`${REGISTRY_URL}/api/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, files: fileContents }),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to publish plugin: ${res.status} ${await res.text()}`);
  }
});

describe('plugin explode install', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-plugin-e2e-');
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.config.json'),
      JSON.stringify({
        platform: 'cursor',
        registries: [{ name: 'e2e', url: REGISTRY_URL, priority: 1 }],
      }),
    );
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

  it('uninstall removes exploded files and hook handlers', () => {
    run(`install ${PLUGIN_NAME}@${PLUGIN_VERSION} --scope project`, tmpDir);
    run(`uninstall ${PLUGIN_NAME}`, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', 'review', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', 'style.mdc'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'skills', PLUGIN_NAME))).toBe(false);
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
});

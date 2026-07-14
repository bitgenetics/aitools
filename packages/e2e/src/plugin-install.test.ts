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
 * Plugin category install e2e — aitools-managed paths, not platform plugin dirs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { REGISTRY_URL, makeE2eProjectDir, rmTmpDir, run } from './test-env.js';

const PLUGIN_NAME = 'e2e-test-plugin';
const PLUGIN_VERSION = '1.0.0';

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
    ],
  };
  const fileContents = {
    '.cursor-plugin/plugin.json': JSON.stringify({ name: PLUGIN_NAME }),
    'skills/review/SKILL.md': '# Review\nE2E plugin skill.',
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

describe('plugin install paths', () => {
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

  it('installs a plugin under .agents/plugins/<pkg>/ with aitools.json at package root', () => {
    run(`install ${PLUGIN_NAME} --scope project`, tmpDir);

    const pluginRoot = path.join(tmpDir, '.agents', 'plugins', PLUGIN_NAME);
    expect(fs.existsSync(path.join(pluginRoot, '.cursor-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(pluginRoot, 'skills', 'review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(pluginRoot, 'aitools.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'plugins', 'local', PLUGIN_NAME))).toBe(false);
  });

  it('uninstall removes the plugin package directory contents', () => {
    run(`install ${PLUGIN_NAME} --scope project`, tmpDir);
    run(`uninstall ${PLUGIN_NAME}`, tmpDir);

    const pluginRoot = path.join(tmpDir, '.agents', 'plugins', PLUGIN_NAME);
    expect(fs.existsSync(pluginRoot)).toBe(false);
  });
});

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
 * Anchor-skill convention + portability grade e2e.
 *
 * Changelog contract: features → "Anchor-skill plugin convention + portability grade".
 * Asserts (1) an anchored multi-skill plugin explodes transform-free with resolving
 * `../<anchor>/…` cross-refs, and (2) `aitools compat` grades transform-free vs
 * rewrite-required.
 */

import fs from 'node:fs';
import path from 'node:path';
import { REGISTRY_URL, makeE2eProjectDir, rmTmpDir, run } from './test-env.js';

const ANCHOR_PLUGIN = 'e2e-anchor-plugin';
const ANCHOR_VERSION = '1.0.0';

/** Sibling-skill markdown that links back to the anchor's shared references. */
const CROSS_REF = `../${ANCHOR_PLUGIN}/references/methodology.md`;

function writeProjectConfig(tmpDir: string, platform: string): void {
  fs.writeFileSync(
    path.join(tmpDir, 'aitools.config.json'),
    JSON.stringify({
      platform,
      registries: [{ name: 'e2e', url: REGISTRY_URL, priority: 1 }],
    }),
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
  // Anchored, transform-free layout: hub skill named after the package owns shared
  // references; the sibling skill links back via ../<anchor>/references/…. All members
  // are native skills (omitted placementMode) so nothing is rewritten at install.
  await publishPlugin(
    {
      name: ANCHOR_PLUGIN,
      version: ANCHOR_VERSION,
      description: 'E2E anchor-skill fixture',
      category: 'plugin',
      nativeFor: 'cursor',
      author: 'e2e',
      files: [
        { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
        { src: `skills/${ANCHOR_PLUGIN}/SKILL.md`, dest: `skills/${ANCHOR_PLUGIN}/SKILL.md` },
        {
          src: `skills/${ANCHOR_PLUGIN}/references/methodology.md`,
          dest: `skills/${ANCHOR_PLUGIN}/references/methodology.md`,
        },
        { src: 'skills/researcher/SKILL.md', dest: 'skills/researcher/SKILL.md' },
      ],
    },
    {
      '.cursor-plugin/plugin.json': JSON.stringify({ name: ANCHOR_PLUGIN }),
      [`skills/${ANCHOR_PLUGIN}/SKILL.md`]: `# ${ANCHOR_PLUGIN}\nHub skill.\n`,
      [`skills/${ANCHOR_PLUGIN}/references/methodology.md`]: '# Methodology\nShared reference.\n',
      'skills/researcher/SKILL.md': `# Researcher\nSee [methodology](${CROSS_REF}).\n`,
    },
  );
});

describe('anchor-skill plugin install', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-anchor-e2e-');
    writeProjectConfig(tmpDir, 'cursor');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('explodes anchored members into sibling skill dirs with resolving cross-refs', () => {
    run(`install ${ANCHOR_PLUGIN}@${ANCHOR_VERSION} --scope project`, tmpDir);

    const anchorSkill = path.join(tmpDir, '.cursor', 'skills', ANCHOR_PLUGIN, 'SKILL.md');
    const anchorRef = path.join(
      tmpDir,
      '.cursor',
      'skills',
      ANCHOR_PLUGIN,
      'references',
      'methodology.md',
    );
    const siblingSkill = path.join(tmpDir, '.cursor', 'skills', 'researcher', 'SKILL.md');

    expect(fs.existsSync(anchorSkill)).toBe(true);
    expect(fs.existsSync(anchorRef)).toBe(true);
    expect(fs.existsSync(siblingSkill)).toBe(true);

    // Transform-free: the cross-ref is left untouched and resolves 1:1 from the sibling.
    const siblingContent = fs.readFileSync(siblingSkill, 'utf8');
    expect(siblingContent).toContain(CROSS_REF);
    const resolved = path.resolve(path.dirname(siblingSkill), CROSS_REF);
    expect(fs.existsSync(resolved)).toBe(true);
    expect(resolved).toBe(anchorRef);
  });
});

describe('aitools compat portability grade', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('aitools-anchor-compat-');
    writeProjectConfig(tmpDir, 'cursor');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  function writePluginManifest(files: Array<{ src: string; dest: string }>): void {
    const allFiles = [
      { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
      ...files,
    ];
    fs.writeFileSync(
      path.join(tmpDir, 'aitools.json'),
      JSON.stringify({
        name: 'local-anchor-plugin',
        version: '1.0.0',
        description: 'local anchor plugin',
        category: 'plugin',
        nativeFor: 'cursor',
        files: allFiles,
      }),
    );
    for (const f of allFiles) {
      const abs = path.join(tmpDir, f.src);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const content = f.src.endsWith('plugin.json') ? '{"name":"local-anchor-plugin"}\n' : '# stub\n';
      fs.writeFileSync(abs, content);
    }
  }

  it('grades an anchored layout transform-free', () => {
    writePluginManifest([
      { src: 'skills/local-anchor-plugin/SKILL.md', dest: 'skills/local-anchor-plugin/SKILL.md' },
      { src: 'skills/researcher/SKILL.md', dest: 'skills/researcher/SKILL.md' },
    ]);
    const out = run('compat --platform cursor', tmpDir);
    expect(out).toContain('Portability');
    expect(out).toContain('transform-free');
  });

  it('grades root-level shared content rewrite-required', () => {
    writePluginManifest([
      { src: 'skills/local-anchor-plugin/SKILL.md', dest: 'skills/local-anchor-plugin/SKILL.md' },
      { src: 'assets/logo.svg', dest: 'assets/logo.svg' },
    ]);
    const out = run('compat --platform cursor', tmpDir);
    expect(out).toContain('rewrite-required');
  });
});

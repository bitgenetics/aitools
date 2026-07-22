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
 * E2E: AI-mech context swap round-trip (discover → swap quarantine → restore).
 * Product contract: .ai/product-changelog/features.md — AI-mech context swap.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  E2E_USER_CONFIG,
  REGISTRY_URL,
  clearE2eUserConfig,
  makeE2eProjectDir,
  rmTmpDir,
  run,
  runGit,
} from './test-env.js';

const PROFILE = 'e2e-context-profile';
const PROFILE_VERSION = '1.0.0';

async function publishContextProfile(): Promise<void> {
  const manifest = {
    name: PROFILE,
    version: PROFILE_VERSION,
    description: 'E2E context-profile fixture',
    category: 'context-profile',
    files: [
      { src: '.cursor/rules/profile.mdc', dest: '.cursor/rules/profile.mdc', placementMode: 'verbatim' },
      { src: '.cursor/skills/profile/SKILL.md', dest: '.cursor/skills/profile/SKILL.md', placementMode: 'verbatim' },
    ],
  };
  const files = {
    '.cursor/rules/profile.mdc': '# profile rule\n',
    '.cursor/skills/profile/SKILL.md': '# Profile skill\n',
  };
  const res = await fetch(`${REGISTRY_URL}/api/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, files }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to publish ${PROFILE}: ${res.status} ${await res.text()}`);
  }
}

function writeFile(projectDir: string, rel: string, content: string): void {
  const abs = path.join(projectDir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

describe('context swap', () => {
  let projectDir: string;

  beforeAll(async () => {
    await publishContextProfile();
  });

  beforeEach(() => {
    projectDir = makeE2eProjectDir('aitools-context-swap-');
    clearE2eUserConfig();
    fs.writeFileSync(
      E2E_USER_CONFIG,
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );

    // Git repo so dirty-tree checks can run (clean tree).
    runGit(['init'], projectDir);
    runGit(['config', 'user.email', 'e2e@test.com'], projectDir);
    runGit(['config', 'user.name', 'e2e'], projectDir);

    writeFile(projectDir, 'AGENTS.md', '# stay agents\n');
    writeFile(projectDir, '.cursor/rules/old.mdc', 'old-rule\n');
    writeFile(projectDir, '.cursor/skills/old/SKILL.md', 'old-skill\n');

    fs.writeFileSync(
      path.join(projectDir, 'aitools.json'),
      JSON.stringify(
        {
          name: 'e2e-context-project',
          context: {
            stay: ['AGENTS.md'],
            profiles: {
              researcher: { package: PROFILE, mode: 'overlay' },
            },
          },
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    runGit(['add', '.'], projectDir);
    runGit(['commit', '-m', 'init'], projectDir);
  });

  afterEach(() => {
    rmTmpDir(projectDir);
    clearE2eUserConfig();
  });

  it('discover → swap (quarantine) → restore round-trip with stay-set', () => {
    const discoverOut = run('context discover --json', projectDir);
    const inventory = JSON.parse(discoverOut) as {
      entries: Array<{ path: string; stay: boolean }>;
    };
    expect(inventory.entries.some((e) => e.path === 'AGENTS.md' && e.stay)).toBe(true);

    run('context swap researcher', projectDir);

    expect(fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8')).toBe('# stay agents\n');
    expect(fs.existsSync(path.join(projectDir, '.cursor/rules/old.mdc'))).toBe(false);
    expect(fs.readFileSync(path.join(projectDir, '.cursor/rules/profile.mdc'), 'utf8')).toContain(
      'profile rule',
    );

    const status = JSON.parse(run('context status --json', projectDir)) as {
      activeProfile: string | null;
      quarantinePresent: boolean;
    };
    expect(status.activeProfile).toBe('researcher');
    expect(status.quarantinePresent).toBe(true);

    run('context restore', projectDir);

    expect(fs.readFileSync(path.join(projectDir, '.cursor/rules/old.mdc'), 'utf8')).toBe('old-rule\n');
    expect(fs.existsSync(path.join(projectDir, '.cursor/rules/profile.mdc'))).toBe(false);
    expect(fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8')).toBe('# stay agents\n');

    const after = JSON.parse(run('context status --json', projectDir)) as {
      activeProfile: string | null;
    };
    expect(after.activeProfile).toBeNull();
  });
});

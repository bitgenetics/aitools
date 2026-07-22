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
 * E2E: AI-mech context swap (discover → swap quarantine → restore).
 * Product contract: .ai/product-changelog/features.md + constraints.md — AI-mech context swap.
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
const BASELINE = 'e2e-context-baseline';
const BASELINE_VERSION = '1.0.0';

async function publishContextPackage(
  name: string,
  version: string,
  files: Record<string, string>,
): Promise<void> {
  const manifest = {
    name,
    version,
    description: `E2E context-profile ${name}`,
    category: 'context-profile',
    files: Object.keys(files).map((src) => ({
      src,
      dest: src,
      placementMode: 'verbatim',
    })),
  };
  const res = await fetch(`${REGISTRY_URL}/api/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, files }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to publish ${name}: ${res.status} ${await res.text()}`);
  }
}

function writeFile(projectDir: string, rel: string, content: string): void {
  const abs = path.join(projectDir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

function writeAitoolsJson(projectDir: string, context: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(projectDir, 'aitools.json'),
    JSON.stringify({ name: 'e2e-context-project', context }, null, 2) + '\n',
    'utf8',
  );
}

function expectRunFails(args: string, cwd: string, pattern: RegExp): void {
  try {
    run(args, cwd);
    throw new Error(`expected command to fail: aitools ${args}`);
  } catch (err) {
    const e = err as { message?: string; stderr?: string; stdout?: string };
    const blob = `${e.message ?? ''}\n${e.stderr ?? ''}\n${e.stdout ?? ''}`;
    expect(blob).toMatch(pattern);
  }
}

describe('context swap', () => {
  let projectDir: string;

  beforeAll(async () => {
    await publishContextPackage(PROFILE, PROFILE_VERSION, {
      '.cursor/rules/profile.mdc': '# profile rule\n',
      '.cursor/skills/profile/SKILL.md': '# Profile skill\n',
    });
    await publishContextPackage(BASELINE, BASELINE_VERSION, {
      '.cursor/rules/baseline.mdc': '# baseline rule\n',
      'AGENTS.md': '# baseline agents\n',
    });
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

    runGit(['init'], projectDir);
    runGit(['config', 'user.email', 'e2e@test.com'], projectDir);
    runGit(['config', 'user.name', 'e2e'], projectDir);

    writeFile(projectDir, 'AGENTS.md', '# stay agents\n');
    writeFile(projectDir, '.cursor/rules/old.mdc', 'old-rule\n');
    writeFile(projectDir, '.cursor/skills/old/SKILL.md', 'old-skill\n');

    writeAitoolsJson(projectDir, {
      stay: ['AGENTS.md'],
      profiles: {
        researcher: { package: PROFILE, mode: 'overlay' },
        ship: { package: PROFILE, mode: 'replace' },
      },
      baseline: { package: BASELINE },
    });

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

  it('refuses swap when tracked AI-mech paths are dirty unless --force', () => {
    writeFile(projectDir, '.cursor/rules/old.mdc', 'dirty-rule\n');
    expectRunFails('context swap researcher', projectDir, /Refusing context|uncommitted/i);
    run('context swap researcher --force', projectDir);
    expect(fs.readFileSync(path.join(projectDir, '.cursor/rules/profile.mdc'), 'utf8')).toContain(
      'profile rule',
    );
  });

  it('replace mode quarantines stay paths too', () => {
    run('context swap ship', projectDir);
    expect(fs.existsSync(path.join(projectDir, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, '.cursor/rules/old.mdc'))).toBe(false);
    expect(fs.readFileSync(path.join(projectDir, '.cursor/rules/profile.mdc'), 'utf8')).toContain(
      'profile rule',
    );
    run('context restore', projectDir);
    expect(fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8')).toBe('# stay agents\n');
  });

  it('accept-stay merges proposal into authored context.stay', () => {
    writeFile(
      projectDir,
      '.aitools/context-stay-proposal.json',
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        targetProfile: 'researcher',
        stay: ['.cursor/rules/old.mdc'],
      }) + '\n',
    );
    run('context accept-stay', projectDir);
    const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'aitools.json'), 'utf8')) as {
      context?: { stay?: string[] };
    };
    expect(manifest.context?.stay).toEqual(expect.arrayContaining(['AGENTS.md', '.cursor/rules/old.mdc']));
  });

  it('restores from registry baseline when quarantine is missing', () => {
    run('context swap researcher', projectDir);
    const status = JSON.parse(run('context status --json', projectDir)) as {
      quarantineId?: string;
    };
    expect(status.quarantineId).toBeTruthy();
    fs.rmSync(path.join(projectDir, '.aitools', 'context-quarantine', status.quarantineId!), {
      recursive: true,
      force: true,
    });

    run('context restore', projectDir);

    expect(fs.existsSync(path.join(projectDir, '.cursor/rules/profile.mdc'))).toBe(false);
    expect(fs.readFileSync(path.join(projectDir, '.cursor/rules/baseline.mdc'), 'utf8')).toContain(
      'baseline rule',
    );
    expect(fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8')).toContain('baseline agents');
  });

  it('installs context-profile as a project tree overlay', () => {
    const empty = makeE2eProjectDir('aitools-context-install-');
    try {
      clearE2eUserConfig();
      fs.writeFileSync(
        E2E_USER_CONFIG,
        JSON.stringify({
          registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
        }),
      );
      run(`install ${PROFILE}@${PROFILE_VERSION}`, empty);
      expect(fs.readFileSync(path.join(empty, '.cursor/rules/profile.mdc'), 'utf8')).toContain(
        'profile rule',
      );
      const lock = JSON.parse(fs.readFileSync(path.join(empty, 'aitools-lock.json'), 'utf8')) as {
        tools: Record<string, { category?: string }>;
      };
      expect(lock.tools[PROFILE]?.category).toBe('context-profile');
    } finally {
      rmTmpDir(empty);
      clearE2eUserConfig();
    }
  });
});

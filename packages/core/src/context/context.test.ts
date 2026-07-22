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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  acceptStayProposal,
  discoverAiMech,
  getContextStatus,
  installContextProfileTree,
  isStayPath,
  matchStayGlob,
  quarantineExists,
  quarantineFiles,
  restoreContext,
  restoreQuarantine,
  swappablePaths,
  swapContextProfile,
  writeManifest,
  writeStayProposal,
  type ToolManifest,
} from '../index.js';

function makeProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-context-'));
}

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
}

describe('matchStayGlob / isStayPath', () => {
  it('matches exact paths', () => {
    expect(matchStayGlob('AGENTS.md', 'AGENTS.md')).toBe(true);
  });

  it('matches trailing /** prefixes', () => {
    expect(matchStayGlob('.cursor/rules/**', '.cursor/rules/a.mdc')).toBe(true);
    expect(matchStayGlob('.cursor/rules/**', '.cursor/skills/x/SKILL.md')).toBe(false);
  });

  it('matches single-segment wildcards', () => {
    expect(matchStayGlob('.cursor/rules/*.mdc', '.cursor/rules/local.mdc')).toBe(true);
  });

  it('isStayPath returns true when any glob matches', () => {
    expect(isStayPath('AGENTS.md', ['CLAUDE.md', 'AGENTS.md'])).toBe(true);
    expect(isStayPath('other.md', ['AGENTS.md'])).toBe(false);
  });
});

describe('discoverAiMech', () => {
  let root: string;

  beforeEach(() => {
    root = makeProject();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('catalogs known AI-mech paths and marks stay', () => {
    writeTree(root, {
      'AGENTS.md': '# agents',
      '.cursor/rules/ship.mdc': 'rule',
      '.cursor/skills/foo/SKILL.md': 'skill',
      'src/index.ts': 'not mech',
    });
    const inv = discoverAiMech(root, { stay: ['AGENTS.md'] });
    const paths = inv.entries.map((e) => e.path);
    expect(paths).toEqual(
      expect.arrayContaining(['AGENTS.md', '.cursor/rules/ship.mdc', '.cursor/skills/foo/SKILL.md']),
    );
    expect(paths).not.toContain('src/index.ts');
    expect(inv.entries.find((e) => e.path === 'AGENTS.md')?.stay).toBe(true);
    expect(inv.entries.find((e) => e.path === '.cursor/rules/ship.mdc')?.stay).toBe(false);
  });

  it('swappablePaths excludes stay in overlay mode', () => {
    writeTree(root, {
      'AGENTS.md': 'a',
      '.cursor/rules/x.mdc': 'r',
    });
    const inv = discoverAiMech(root, { stay: ['AGENTS.md'] });
    expect(swappablePaths(inv, 'overlay')).toEqual(['.cursor/rules/x.mdc']);
    expect(swappablePaths(inv, 'replace').sort()).toEqual(['.cursor/rules/x.mdc', 'AGENTS.md'].sort());
  });
});

describe('quarantine round-trip', () => {
  let root: string;

  beforeEach(() => {
    root = makeProject();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('moves files out and restores exact bytes', () => {
    writeTree(root, {
      'AGENTS.md': 'baseline agents',
      '.cursor/rules/a.mdc': 'rule-a',
    });
    const manifest = quarantineFiles(root, ['AGENTS.md', '.cursor/rules/a.mdc']);
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false);
    expect(quarantineExists(root, manifest.id)).toBe(true);
    restoreQuarantine(root, manifest.id);
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toBe('baseline agents');
    expect(fs.readFileSync(path.join(root, '.cursor/rules/a.mdc'), 'utf8')).toBe('rule-a');
    expect(quarantineExists(root, manifest.id)).toBe(false);
  });
});

describe('swapContextProfile / restoreContext', () => {
  let root: string;
  let agentsDir: string;

  beforeEach(() => {
    root = makeProject();
    agentsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-profile-'));
    writeTree(root, {
      'AGENTS.md': 'stay-me',
      '.cursor/rules/old.mdc': 'old-rule',
      '.cursor/skills/old/SKILL.md': 'old-skill',
    });
    writeTree(agentsDir, {
      '.cursor/rules/role.mdc': 'role-rule',
      '.cursor/skills/role/SKILL.md': 'role-skill',
    });
    writeManifest(root, {
      name: 'demo',
      context: {
        stay: ['AGENTS.md'],
        profiles: {
          researcher: { package: 'role-researcher', mode: 'overlay' },
        },
      },
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(agentsDir, { recursive: true, force: true });
  });

  it('quarantines non-stay, installs profile, restores from quarantine', async () => {
    const profileManifest: ToolManifest = {
      name: 'role-researcher',
      version: '1.0.0',
      description: 'test profile',
      category: 'context-profile',
      files: [
        { src: '.cursor/rules/role.mdc', dest: '.cursor/rules/role.mdc' },
        { src: '.cursor/skills/role/SKILL.md', dest: '.cursor/skills/role/SKILL.md' },
      ],
    };

    const swap = await swapContextProfile(root, 'researcher', {
      force: true,
      resolveProfile: async () => ({
        manifest: profileManifest,
        agentsDir,
        integrity: 'test-integrity',
        resolved: 'http://registry.test',
      }),
    });

    expect(swap.quarantine.moves.map((m) => m.from).sort()).toEqual(
      ['.cursor/rules/old.mdc', '.cursor/skills/old/SKILL.md'].sort(),
    );
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toBe('stay-me');
    expect(fs.existsSync(path.join(root, '.cursor/rules/old.mdc'))).toBe(false);
    expect(fs.readFileSync(path.join(root, '.cursor/rules/role.mdc'), 'utf8')).toBe('role-rule');

    const status = getContextStatus(root);
    expect(status.activeProfile).toBe('researcher');
    expect(status.quarantinePresent).toBe(true);

    const restored = await restoreContext(root, { force: true });
    expect(restored.restoredFrom).toBe('quarantine');
    expect(fs.readFileSync(path.join(root, '.cursor/rules/old.mdc'), 'utf8')).toBe('old-rule');
    expect(fs.existsSync(path.join(root, '.cursor/rules/role.mdc'))).toBe(false);
    expect(getContextStatus(root).activeProfile).toBeNull();
  });

  it('refuses overlay swap without authored stay', async () => {
    writeManifest(root, {
      context: {
        profiles: { researcher: { package: 'role-researcher', mode: 'overlay' } },
      },
    });
    await expect(
      swapContextProfile(root, 'researcher', {
        force: true,
        resolveProfile: async () => {
          throw new Error('should not resolve');
        },
      }),
    ).rejects.toThrow(/authored context\.stay/);
  });
});

describe('acceptStayProposal', () => {
  let root: string;

  beforeEach(() => {
    root = makeProject();
    writeManifest(root, { name: 'demo', context: { stay: ['AGENTS.md'] } });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('merges proposal into authored stay', () => {
    writeStayProposal(root, {
      generatedAt: new Date().toISOString(),
      targetProfile: 'researcher',
      stay: ['.cursor/rules/local.mdc', 'AGENTS.md'],
    });
    const stay = acceptStayProposal(root);
    expect(stay).toEqual(['AGENTS.md', '.cursor/rules/local.mdc']);
  });
});

describe('installContextProfileTree', () => {
  it('rejects non context-profile category', () => {
    const root = makeProject();
    try {
      expect(() =>
        installContextProfileTree(root, root, {
          name: 'x',
          version: '1.0.0',
          description: 'x',
          category: 'skill',
          files: [{ src: 'a.md', dest: 'a.md' }],
        }, { integrity: 'i', resolved: 'r' }),
      ).toThrow(/context-profile/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

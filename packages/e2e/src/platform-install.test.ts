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
 * Platform-aware install e2e tests.
 *
 * Verifies that setting a platform via config causes tools (skills, subagents,
 * prompts) to install into the correct platform-specific directory.
 *
 * Also verifies that multi-platform file entries are resolved correctly —
 * only the matching platform file (or fallback generic) is installed.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REGISTRY_URL, makeE2eProjectDir, rmTmpDir, run } from './test-env.js';

async function publishTool(
  name: string,
  version: string,
  category: 'skill' | 'subagent' | 'prompt',
  files: { src: string; dest: string; platform?: string }[],
  fileContents: Record<string, string>,
): Promise<void> {
  const manifest = {
    name,
    version,
    description: `Platform e2e fixture: ${name}`,
    category,
    author: 'e2e',
    files,
  };

  const res = await fetch(`${REGISTRY_URL}/api/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, files: fileContents }),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to publish ${name}@${version}: ${res.status} ${await res.text()}`);
  }
}

function makeProjectDir(platform: string): string {
  const tmp = makeE2eProjectDir('ai-tools-plat-e2e-');
  fs.writeFileSync(
    path.join(tmp, 'ai-tools.config.json'),
    JSON.stringify({
      platform,
      registries: [{ name: 'e2e', url: REGISTRY_URL, priority: 1 }],
    }),
  );
  return tmp;
}

// ---------------------------------------------------------------------------
// Expected install directories per platform + category (project scope)
// ---------------------------------------------------------------------------

const EXPECTED_DIRS: Record<string, Record<string, string>> = {
  vscode: {
    skill: path.join('.agents', 'skills'),
    subagent: path.join('.github', 'agents'),
    prompt: path.join('.agents', 'prompts'),
  },
  claude: {
    skill: path.join('.claude', 'skills'),
    subagent: path.join('.claude', 'agents'),
    prompt: path.join('.claude', 'commands'),
  },
  cursor: {
    skill: path.join('.agents', 'skills'),
    subagent: path.join('.agents', 'agents'),
    prompt: path.join('.agents', 'prompts'),
  },
  windsurf: {
    skill: path.join('.windsurf', 'skills'),
    subagent: path.join('.windsurf', 'agents'),
    prompt: path.join('.windsurf', 'rules'),
  },
};

// ---------------------------------------------------------------------------
// Fixtures — one per category
// ---------------------------------------------------------------------------

const FIXTURES = {
  skill: {
    name: 'e2e-platform-skill',
    files: [{ src: 'SKILL.md', dest: 'e2e-platform-skill.md' }],
    fileContents: { 'SKILL.md': '# Platform Skill\nInstalled correctly.' },
  },
  subagent: {
    name: 'e2e-platform-agent',
    files: [{ src: 'agent.md', dest: 'e2e-platform-agent.md' }],
    fileContents: { 'agent.md': '# Platform Agent\nInstalled correctly.' },
  },
  prompt: {
    name: 'e2e-platform-prompt',
    files: [{ src: 'prompt.md', dest: 'e2e-platform-prompt.md' }],
    fileContents: { 'prompt.md': '# Platform Prompt\nInstalled correctly.' },
  },
};

// Multi-platform fixture: has vscode-specific + claude-specific + generic fallback
const MULTI_PLATFORM_FIXTURE = {
  name: 'e2e-multi-platform-skill',
  files: [
    { src: 'SKILL.vscode.md', dest: 'SKILL.md', platform: 'vscode' },
    { src: 'SKILL.claude.md', dest: 'SKILL.md', platform: 'claude' },
    { src: 'SKILL.generic.md', dest: 'SKILL.md' },
  ],
  fileContents: {
    'SKILL.vscode.md': '# VS Code variant',
    'SKILL.claude.md': '# Claude variant',
    'SKILL.generic.md': '# Generic fallback',
  },
};

// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Publish all category fixtures
  for (const [category, fixture] of Object.entries(FIXTURES)) {
    await publishTool(
      fixture.name,
      '1.0.0',
      category as 'skill' | 'subagent' | 'prompt',
      fixture.files,
      fixture.fileContents,
    );
  }

  // Publish multi-platform fixture
  await publishTool(
    MULTI_PLATFORM_FIXTURE.name,
    '1.0.0',
    'skill',
    MULTI_PLATFORM_FIXTURE.files,
    MULTI_PLATFORM_FIXTURE.fileContents,
  );
});

// ---------------------------------------------------------------------------

describe('platform-aware install paths', () => {
  const platforms = ['vscode', 'claude', 'cursor', 'windsurf'] as const;
  const categories = ['skill', 'subagent', 'prompt'] as const;

  for (const platform of platforms) {
    describe(`platform: ${platform}`, () => {
      let tmpDir: string;

      beforeEach(() => {
        tmpDir = makeProjectDir(platform);
      });

      afterEach(() => {
        rmTmpDir(tmpDir);
      });

      for (const category of categories) {
        it(`installs a ${category} to ${EXPECTED_DIRS[platform]![category]}`, () => {
          const fixture = FIXTURES[category];
          run(`install ${fixture.name} --scope project`, tmpDir);

          const expectedDir = path.join(tmpDir, EXPECTED_DIRS[platform]![category]!);
          const expectedFile = path.join(expectedDir, fixture.files[0]!.dest);
          expect(fs.existsSync(expectedFile)).toBe(true);

          const content = fs.readFileSync(expectedFile, 'utf8');
          expect(content).toContain('Installed correctly.');
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------

describe('multi-platform file selection', () => {
  it('installs vscode-specific file when platform is vscode', () => {
    const tmpDir = makeProjectDir('vscode');
    try {
      run(`install ${MULTI_PLATFORM_FIXTURE.name} --scope project`, tmpDir);

      const installedFile = path.join(
        tmpDir,
        EXPECTED_DIRS['vscode']!['skill']!,
        'SKILL.md',
      );
      expect(fs.existsSync(installedFile)).toBe(true);
      expect(fs.readFileSync(installedFile, 'utf8')).toBe('# VS Code variant');
    } finally {
      rmTmpDir(tmpDir);
    }
  });

  it('installs claude-specific file when platform is claude', () => {
    const tmpDir = makeProjectDir('claude');
    try {
      run(`install ${MULTI_PLATFORM_FIXTURE.name} --scope project`, tmpDir);

      const installedFile = path.join(
        tmpDir,
        EXPECTED_DIRS['claude']!['skill']!,
        'SKILL.md',
      );
      expect(fs.existsSync(installedFile)).toBe(true);
      expect(fs.readFileSync(installedFile, 'utf8')).toBe('# Claude variant');
    } finally {
      rmTmpDir(tmpDir);
    }
  });

  it('falls back to generic file when platform has no specific entry', () => {
    const tmpDir = makeProjectDir('cursor');
    try {
      run(`install ${MULTI_PLATFORM_FIXTURE.name} --scope project`, tmpDir);

      const installedFile = path.join(
        tmpDir,
        EXPECTED_DIRS['cursor']!['skill']!,
        'SKILL.md',
      );
      expect(fs.existsSync(installedFile)).toBe(true);
      expect(fs.readFileSync(installedFile, 'utf8')).toBe('# Generic fallback');
    } finally {
      rmTmpDir(tmpDir);
    }
  });

  it('falls back to generic file when platform is windsurf (no windsurf entry)', () => {
    const tmpDir = makeProjectDir('windsurf');
    try {
      run(`install ${MULTI_PLATFORM_FIXTURE.name} --scope project`, tmpDir);

      const installedFile = path.join(
        tmpDir,
        EXPECTED_DIRS['windsurf']!['skill']!,
        'SKILL.md',
      );
      expect(fs.existsSync(installedFile)).toBe(true);
      expect(fs.readFileSync(installedFile, 'utf8')).toBe('# Generic fallback');
    } finally {
      rmTmpDir(tmpDir);
    }
  });
});

// ---------------------------------------------------------------------------

describe('platform guard rejects incompatible tools', () => {
  const incompatibleName = 'e2e-vscode-only-tool';

  beforeAll(async () => {
    await publishTool(
      incompatibleName,
      '1.0.0',
      'skill',
      [{ src: 'SKILL.md', dest: 'SKILL.md' }],
      { 'SKILL.md': '# VS Code only' },
    );

    // Re-publish with platforms restriction via a new version
    const manifest = {
      name: incompatibleName,
      version: '2.0.0',
      description: 'Only supports vscode',
      category: 'skill',
      author: 'e2e',
      files: [{ src: 'SKILL.md', dest: 'SKILL.md' }],
      platforms: ['vscode'],
    };

    const res = await fetch(`${REGISTRY_URL}/api/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, files: { 'SKILL.md': '# VS Code only v2' } }),
    });

    if (!res.ok && res.status !== 409) {
      throw new Error(`Failed to publish ${incompatibleName}@2.0.0: ${res.status}`);
    }
  });

  it('installs when active platform matches manifest.platforms', () => {
    const tmpDir = makeProjectDir('vscode');
    try {
      expect(() => {
        run(`install ${incompatibleName}@2.0.0 --scope project`, tmpDir);
      }).not.toThrow();
    } finally {
      rmTmpDir(tmpDir);
    }
  });

  it('rejects install when active platform is not in manifest.platforms', () => {
    const tmpDir = makeProjectDir('claude');
    try {
      expect(() => {
        run(`install ${incompatibleName}@2.0.0 --scope project`, tmpDir);
      }).toThrow();
    } finally {
      rmTmpDir(tmpDir);
    }
  });
});

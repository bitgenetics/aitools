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
import { createManifestCommand } from './manifest.js';
import { createInterface } from 'node:readline/promises';

jest.mock('node:readline/promises', () => ({
  createInterface: jest.fn(),
}));

const VALID_MANIFEST = {
  name: 'my-skill',
  version: '1.0.0',
  description: 'A test skill',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'skill.md' }],
};

describe('manifest command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-manifest-'));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
    jest.clearAllMocks();
  });

  describe('validate subcommand', () => {
    it('succeeds for a valid manifest', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      // validate also checks declared files exist on disk
      fs.writeFileSync(path.join(tmp, 'skill.md'), '# Skill', 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['validate'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output.toLowerCase()).toMatch(/valid|ok|success/);
      logSpy.mockRestore();
    });

    it('exits with error for an invalid manifest', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify({ name: 'bad' }), 'utf8');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['validate'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('exits when manifest file is missing', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['validate'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('exits when only legacy aitools.manifest.json is present', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.manifest.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['validate'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('exits when manifest JSON is malformed', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), '{ bad json', 'utf8');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['validate'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('exits when declared source files are missing on disk', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['validate'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('succeeds for a valid plugin structure', () => {
      const pluginManifest = {
        name: 'valid-plugin',
        version: '1.0.0',
        description: 'ok',
        category: 'plugin',
        nativeFor: 'cursor',
        files: [
          { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
          { src: 'skills/a/SKILL.md', dest: 'skills/a/SKILL.md' },
          { src: 'scripts/x.sh', dest: 'scripts/x.sh' },
        ],
      };
      fs.mkdirSync(path.join(tmp, '.cursor-plugin'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'skills', 'a'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.cursor-plugin', 'plugin.json'), '{}', 'utf8');
      fs.writeFileSync(path.join(tmp, 'skills', 'a', 'SKILL.md'), '# A', 'utf8');
      fs.writeFileSync(path.join(tmp, 'scripts', 'x.sh'), '#!/bin/sh\n', 'utf8');
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(pluginManifest), 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['validate'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toMatch(/Plugin structure/i);
      logSpy.mockRestore();
    });

    it('exits when a plugin has orphan files', () => {
      const pluginManifest = {
        name: 'bad-plugin',
        version: '1.0.0',
        description: 'bad',
        category: 'plugin',
        nativeFor: 'cursor',
        files: [
          { src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' },
          { src: 'orphan.bin', dest: 'orphan.bin' },
        ],
      };
      fs.mkdirSync(path.join(tmp, '.cursor-plugin'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.cursor-plugin', 'plugin.json'), '{}', 'utf8');
      fs.writeFileSync(path.join(tmp, 'orphan.bin'), 'x', 'utf8');
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(pluginManifest), 'utf8');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['validate'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });
  });

  describe('bump subcommand', () => {
    it('increments the patch version', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['bump', 'patch'], { from: 'user' });
      const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as { version: string };
      expect(updated.version).toBe('1.0.1');
    });

    it('increments the minor version', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['bump', 'minor'], { from: 'user' });
      const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as { version: string };
      expect(updated.version).toBe('1.1.0');
    });

    it('increments the major version', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['bump', 'major'], { from: 'user' });
      const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as { version: string };
      expect(updated.version).toBe('2.0.0');
    });

    it('sets an explicit semver version', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['bump', '3.0.0'], { from: 'user' });
      const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as { version: string };
      expect(updated.version).toBe('3.0.0');
    });

    it('exits for an invalid bump release argument', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['bump', 'not-a-version'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('exits when manifest is missing for bump', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['bump', 'patch'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('exits when explicit bump version is not greater than current', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['bump', '0.9.0'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });

    it('exits when current manifest version is not valid semver', () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({ ...VALID_MANIFEST, version: 'not-semver' }),
        'utf8',
      );
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['bump', 'patch'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });
  });

  describe('init subcommand', () => {
    it('creates aitools.json in the current directory', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['init', '--name', 'new-skill', '--category', 'skill', '--yes'], { from: 'user' });
      expect(fs.existsSync(path.join(tmp, 'aitools.json'))).toBe(true);
    });

    it('creates manifest entries from explicit --file options', () => {
      fs.writeFileSync(path.join(tmp, 'custom.md'), '# Custom', 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(
        ['init', '--name', 'file-skill', '--category', 'skill', '--yes', '--file', 'custom.md:custom.md'],
        { from: 'user' },
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        files: Array<{ src: string; dest: string }>;
      };
      expect(manifest.files).toEqual([{ src: 'custom.md', dest: 'custom.md' }]);
    });

    it('refuses to overwrite an existing manifest without --force', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['init', '--name', 'other', '--yes'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toMatch(/publish fields/);
      logSpy.mockRestore();
    });

    it('auto-detects markdown files during non-interactive init', () => {
      fs.writeFileSync(path.join(tmp, 'found.md'), '# Found', 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(['init', '--name', 'found-skill', '--yes'], { from: 'user' });
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        files: Array<{ src: string; dest: string }>;
      };
      expect(manifest.files).toEqual([{ src: 'found.md', dest: 'found-skill/found.md' }]);
    });

    it('includes optional author and keywords in non-interactive init', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(
        ['init', '--name', 'meta-skill', '--yes', '--author', 'Me', '--keywords', 'a, b'],
        { from: 'user' },
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        author: string;
        keywords: string[];
      };
      expect(manifest.author).toBe('Me');
      expect(manifest.keywords).toEqual(['a', 'b']);
    });

    it('auto-detects plugin tree files and skips aitools bookkeeping files', () => {
      fs.mkdirSync(path.join(tmp, '.cursor-plugin'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.cursor-plugin', 'plugin.json'), '{}', 'utf8');
      fs.mkdirSync(path.join(tmp, 'skills', 'review'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'skills', 'review', 'SKILL.md'), '# Review', 'utf8');
      fs.writeFileSync(path.join(tmp, 'aitools-lock.json'), '{}', 'utf8');
      fs.writeFileSync(path.join(tmp, 'aitools.config.json'), '{}', 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(
        ['init', '--name', '@team/my-plugin', '--category', 'plugin', '--nativeFor', 'cursor', '--yes'],
        { from: 'user' },
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        category: string;
        nativeFor: string;
        files: Array<{ src: string }>;
      };
      expect(manifest.category).toBe('plugin');
      expect(manifest.nativeFor).toBe('cursor');
      const srcs = manifest.files.map((f) => f.src);
      expect(srcs).toContain('.cursor-plugin/plugin.json');
      expect(srcs).toContain('skills/review/SKILL.md');
      expect(srcs).not.toContain('aitools-lock.json');
      expect(srcs).not.toContain('aitools.config.json');
    });

    it('excludes installed tool paths and docs from plugin init', () => {
      fs.mkdirSync(path.join(tmp, '.cursor-plugin'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.cursor-plugin', 'plugin.json'), '{}', 'utf8');
      fs.mkdirSync(path.join(tmp, 'skills', 'review'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'skills', 'review', 'SKILL.md'), '# Review', 'utf8');
      fs.mkdirSync(path.join(tmp, '.cursor', 'skills', 'create-ai-tool'), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, '.cursor', 'skills', 'create-ai-tool', 'SKILL.md'),
        '# Dev tool',
        'utf8',
      );
      fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'docs', 'RESEARCH-METHODOLOGY.md'), '# Methodology', 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(
        ['init', '--name', 'plugin-researcher', '--category', 'plugin', '--nativeFor', 'cursor', '--yes', '--force'],
        { from: 'user' },
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        files: Array<{ src: string }>;
      };
      const srcs = manifest.files.map((f) => f.src);
      expect(srcs).toContain('skills/review/SKILL.md');
      expect(srcs).not.toContain('.cursor/skills/create-ai-tool/SKILL.md');
      expect(srcs).not.toContain('docs/RESEARCH-METHODOLOGY.md');
      logSpy.mockRestore();
    });

    it('prompts for root-level SKILL.md alongside skill folders', async () => {
      fs.writeFileSync(path.join(tmp, 'SKILL.md'), '# Root skill', 'utf8');
      fs.mkdirSync(path.join(tmp, 'nested-skill'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'nested-skill', 'SKILL.md'), '# Nested', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('')   // name
        .mockResolvedValueOnce('')   // version
        .mockResolvedValueOnce('')   // description
        .mockResolvedValueOnce('')   // category
        .mockResolvedValueOnce('')   // author
        .mockResolvedValueOnce('')   // repository
        .mockResolvedValueOnce('')   // keywords
        .mockResolvedValueOnce('')   // tags
        .mockResolvedValueOnce('y')  // include root SKILL.md
        .mockResolvedValueOnce('n'); // include nested-skill? no
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      const defaultName = path.basename(tmp).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      expect(manifest.files).toEqual([{ src: 'SKILL.md', dest: `${defaultName}/SKILL.md` }]);
    });

    it('prompts for root-level SKILL.md when no subfolders exist', async () => {
      fs.writeFileSync(path.join(tmp, 'SKILL.md'), '# Root skill', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('root-skill') // name
        .mockResolvedValueOnce('')           // version
        .mockResolvedValueOnce('')           // description
        .mockResolvedValueOnce('')           // category
        .mockResolvedValueOnce('')           // author
        .mockResolvedValueOnce('')           // repository
        .mockResolvedValueOnce('')           // keywords
        .mockResolvedValueOnce('')           // tags
        .mockResolvedValueOnce('y');          // include root SKILL.md
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual([{ src: 'SKILL.md', dest: 'root-skill/SKILL.md' }]);
    });

    it('prompts for each detected skill folder and includes only confirmed ones', async () => {
      // Create two skill folders � detectContentFolders looks for subdirs with direct content files
      fs.mkdirSync(path.join(tmp, 'my-skill'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'my-skill', 'SKILL.md'), '# Skill', 'utf8');
      fs.mkdirSync(path.join(tmp, 'other-skill'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'other-skill', 'SKILL.md'), '# Other', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('')   // name
        .mockResolvedValueOnce('')   // version
        .mockResolvedValueOnce('')   // description
        .mockResolvedValueOnce('')   // category
        .mockResolvedValueOnce('')   // author
        .mockResolvedValueOnce('')   // repository
        .mockResolvedValueOnce('')   // keywords
        .mockResolvedValueOnce('')   // tags
        .mockResolvedValueOnce('n')  // include my-skill? (alphabetically first)
        .mockResolvedValueOnce('y'); // include other-skill?
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const defaultName = path.basename(tmp).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual([
        { src: 'other-skill/SKILL.md', dest: `${defaultName}/other-skill/SKILL.md` },
      ]);
    });

    it('falls back to placeholder when all skill folders are declined', async () => {
      fs.mkdirSync(path.join(tmp, 'my-skill'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'my-skill', 'SKILL.md'), '# Skill', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('my-tool') // name
        .mockResolvedValueOnce('')         // version
        .mockResolvedValueOnce('')         // description
        .mockResolvedValueOnce('')         // category
        .mockResolvedValueOnce('')         // author
        .mockResolvedValueOnce('')         // repository
        .mockResolvedValueOnce('')         // keywords
        .mockResolvedValueOnce('')         // tags
        .mockResolvedValueOnce('n')        // include my-skill? no
        .mockResolvedValueOnce('n');       // pick files individually? no
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual([{ src: 'my-tool/SKILL.md', dest: 'my-tool/SKILL.md' }]);
    });

    it('offers per-file picker when folder selection is declined', async () => {
      fs.mkdirSync(path.join(tmp, 'my-skill'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'my-skill', 'SKILL.md'), '# Skill', 'utf8');
      fs.writeFileSync(path.join(tmp, 'my-skill', 'guide.md'), '# Guide', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('')   // name
        .mockResolvedValueOnce('')   // version
        .mockResolvedValueOnce('')   // description
        .mockResolvedValueOnce('')   // category
        .mockResolvedValueOnce('')   // author
        .mockResolvedValueOnce('')   // repository
        .mockResolvedValueOnce('')   // keywords
        .mockResolvedValueOnce('')   // tags
        .mockResolvedValueOnce('n')  // include my-skill folder? no
        .mockResolvedValueOnce('y')  // pick files individually? yes
        .mockResolvedValueOnce('y')  // include my-skill/SKILL.md
        .mockResolvedValueOnce('')   // dest default
        .mockResolvedValueOnce('n'); // include my-skill/guide.md no
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const defaultName = path.basename(tmp).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual([
        { src: 'my-skill/SKILL.md', dest: `${defaultName}/my-skill/SKILL.md` },
      ]);
    });

    it('uses per-file picker when init --pick-files is set', async () => {
      fs.writeFileSync(path.join(tmp, 'agent.md'), '# Agent', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('review-agent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('subagent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('y')
        .mockResolvedValueOnce('review.md');
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init', '--pick-files'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { category: string; files: Array<{ src: string; dest: string }> };
      expect(manifest.category).toBe('subagent');
      expect(manifest.files).toEqual([{ src: 'agent.md', dest: 'review.md' }]);
    });

    it('prompts for root-level agent.md for subagent category', async () => {
      fs.writeFileSync(path.join(tmp, 'agent.md'), '# Agent', 'utf8');
      fs.mkdirSync(path.join(tmp, 'agents', 'reviewer'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'agents', 'reviewer', 'agent.md'), '# Reviewer', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('review-agent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('subagent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('y')
        .mockResolvedValueOnce('n');
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { category: string; files: Array<{ src: string }> };
      expect(manifest.category).toBe('subagent');
      expect(manifest.files).toEqual([{ src: 'agent.md', dest: 'review-agent/agent.md' }]);
    });

    it('uses agent.md placeholder when subagent folders are declined', async () => {
      fs.mkdirSync(path.join(tmp, 'agents', 'reviewer'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'agents', 'reviewer', 'agent.md'), '# Reviewer', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('review-agent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('subagent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('n')
        .mockResolvedValueOnce('n');
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual([
        { src: 'review-agent/agent.md', dest: 'review-agent/agent.md' },
      ]);
    });

    it('auto-detects prompt.md for prompt category in non-interactive init', () => {
      fs.writeFileSync(path.join(tmp, 'prompt.md'), '# Prompt', 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(
        ['init', '--name', 'commit-msg', '--category', 'prompt', '--yes'],
        { from: 'user' },
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        category: string;
        files: Array<{ src: string }>;
      };
      expect(manifest.category).toBe('prompt');
      expect(manifest.files).toEqual([{ src: 'prompt.md', dest: 'commit-msg/prompt.md' }]);
    });

    it('auto-detects root and nested server files for mcp-tool and scaffolds mcpServer', () => {
      fs.writeFileSync(path.join(tmp, 'server.js'), 'export {}', 'utf8');
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"x"}', 'utf8');
      fs.mkdirSync(path.join(tmp, 'lib'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'lib', 'helpers.js'), 'module.exports = {}', 'utf8');

      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(
        ['init', '--name', 'my-mcp', '--category', 'mcp-tool', '--yes'],
        { from: 'user' },
      );

      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        category: string;
        files: Array<{ src: string }>;
        mcpServer: { command: string; args: string[]; type: string };
      };
      const srcs = manifest.files.map((f) => f.src);
      expect(manifest.category).toBe('mcp-tool');
      expect(srcs).toContain('server.js');
      expect(srcs).toContain('lib/helpers.js');
      expect(srcs).not.toContain('package.json');
      expect(manifest.mcpServer).toEqual({
        command: 'node',
        args: ['${installDir}/server.js'],
        type: 'stdio',
      });
    });

    it('scaffolds mcpServer with tsx when only a TypeScript entry file exists', () => {
      fs.writeFileSync(path.join(tmp, 'server.ts'), 'export {}', 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createManifestCommand().parse(
        ['init', '--name', 'ts-mcp', '--category', 'mcp-tool', '--yes'],
        { from: 'user' },
      );
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        files: Array<{ src: string }>;
        mcpServer: { command: string; args: string[]; type: string };
      };
      expect(manifest.files).toEqual([{ src: 'server.ts', dest: 'server.ts' }]);
      expect(manifest.mcpServer).toEqual({
        command: 'npx',
        args: ['tsx', '${installDir}/server.ts'],
        type: 'stdio',
      });
    });

    it('prompts for root-level server.js for mcp-tool category', async () => {
      fs.writeFileSync(path.join(tmp, 'server.js'), 'export {}', 'utf8');
      fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'tools', 'extra.js'), 'export {}', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('db-mcp')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('mcp-tool')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('y')
        .mockResolvedValueOnce('n');
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['init'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as {
        category: string;
        files: Array<{ src: string }>;
        mcpServer: { command: string; args: string[] };
      };
      expect(manifest.category).toBe('mcp-tool');
      expect(manifest.files).toEqual([{ src: 'server.js', dest: 'server.js' }]);
      expect(manifest.mcpServer.command).toBe('node');
      expect(manifest.mcpServer.args).toEqual(['${installDir}/server.js']);
    });
  });

  describe('files subcommand', () => {
    it('includes only selected files with dest overrides', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({
          ...VALID_MANIFEST,
          files: [{ src: 'skill.md', dest: 'skill.md' }],
        }),
        'utf8',
      );
      fs.writeFileSync(path.join(tmp, 'skill.md'), '# Skill', 'utf8');
      fs.writeFileSync(path.join(tmp, 'extra.md'), '# Extra', 'utf8');

      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('n')           // extra.md — exclude
        .mockResolvedValueOnce('y')           // skill.md — include
        .mockResolvedValueOnce('renamed.md'); // skill.md dest
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['files'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual([
        { src: 'skill.md', dest: 'renamed.md' },
      ]);
    });

    it('merges with existing manifest entries outside the scan set', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({
          ...VALID_MANIFEST,
          files: [
            { src: 'skill.md', dest: 'skill.md' },
            { src: 'manual-only.md', dest: 'manual-only.md' },
          ],
        }),
        'utf8',
      );
      fs.writeFileSync(path.join(tmp, 'skill.md'), '# Skill', 'utf8');

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['files', '--yes'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual(
        expect.arrayContaining([
          { src: 'manual-only.md', dest: 'manual-only.md' },
          { src: 'skill.md', dest: 'my-skill/skill.md' },
        ]),
      );
      expect(manifest.files).toHaveLength(2);
    });

    it('replaces files entirely with --force', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({
          ...VALID_MANIFEST,
          files: [
            { src: 'skill.md', dest: 'skill.md' },
            { src: 'manual-only.md', dest: 'manual-only.md' },
          ],
        }),
        'utf8',
      );
      fs.writeFileSync(path.join(tmp, 'skill.md'), '# Skill', 'utf8');

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['files', '--yes', '--force'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string; dest: string }> };
      expect(manifest.files).toEqual([{ src: 'skill.md', dest: 'my-skill/skill.md' }]);
    });

    it('uses plugin bundle scan for plugin category', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({
          name: 'my-plugin',
          version: '1.0.0',
          description: 'plugin',
          category: 'plugin',
          nativeFor: 'cursor',
          files: [{ src: '.cursor-plugin/plugin.json', dest: '.cursor-plugin/plugin.json' }],
        }),
        'utf8',
      );
      fs.mkdirSync(path.join(tmp, '.cursor-plugin'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.cursor-plugin', 'plugin.json'), '{}', 'utf8');
      fs.mkdirSync(path.join(tmp, 'skills', 'review'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'skills', 'review', 'SKILL.md'), '# Review', 'utf8');
      fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'docs', 'README.md'), '# Docs', 'utf8');

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['files', '--yes', '--force'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as { files: Array<{ src: string }> };
      const srcs = manifest.files.map((f) => f.src);
      expect(srcs).toContain('skills/review/SKILL.md');
      expect(srcs).not.toContain('docs/README.md');
    });

    it('errors when no manifest exists and --category is omitted', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });
      await expect(
        createManifestCommand().parseAsync(['files'], { from: 'user' }),
      ).rejects.toThrow('exit');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});

describe('manifest update', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-manifest-update-'));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
    jest.clearAllMocks();
  });

  it('errors when no manifest exists', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    await expect(
      createManifestCommand().parseAsync(['update', '--yes'], { from: 'user' }),
    ).rejects.toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  describe('--yes (non-interactive)', () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify(VALID_MANIFEST),
        'utf8',
      );
    });

    it('applies --description flag and keeps everything else unchanged', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(
        ['update', '--yes', '--description', 'Updated description'],
        { from: 'user' },
      );
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['description']).toBe('Updated description');
      expect(manifest['name']).toBe('my-skill');
      expect(manifest['version']).toBe('1.0.0');
    });

    it('sets platforms when --platforms flag is supplied', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(
        ['update', '--yes', '--platforms', 'vscode,claude'],
        { from: 'user' },
      );
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['platforms']).toEqual(['vscode', 'claude']);
    });

    it('removes platforms when --platforms is passed an empty string', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({ ...VALID_MANIFEST, platforms: ['vscode'] }),
        'utf8',
      );
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(
        ['update', '--yes', '--platforms', ''],
        { from: 'user' },
      );
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['platforms']).toBeUndefined();
    });

    it('replaces tags with comma-separated list', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(
        ['update', '--yes', '--tags', 'lint, refactor'],
        { from: 'user' },
      );
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['tags']).toEqual(['lint', 'refactor']);
    });

    it('replaces keywords with comma-separated list', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(
        ['update', '--yes', '--keywords', 'jest, tdd, typescript'],
        { from: 'user' },
      );
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['keywords']).toEqual(['jest', 'tdd', 'typescript']);
    });

    it('removes keywords when --keywords is empty', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({ ...VALID_MANIFEST, keywords: ['old'] }),
        'utf8',
      );
      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(
        ['update', '--yes', '--keywords', ''],
        { from: 'user' },
      );
      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['keywords']).toBeUndefined();
    });
  });

  describe('interactive', () => {
    it('prompts with existing values as defaults and writes updated manifest', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({ ...VALID_MANIFEST, author: 'Old Author', platforms: ['vscode'] }),
        'utf8',
      );
      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('')           // name (keep)
        .mockResolvedValueOnce('')           // version (keep)
        .mockResolvedValueOnce('')           // description (keep)
        .mockResolvedValueOnce('')           // category (keep)
        .mockResolvedValueOnce('New Author') // author
        .mockResolvedValueOnce('')           // repository (keep)
        .mockResolvedValueOnce('')           // keywords (keep)
        .mockResolvedValueOnce('')           // tags (keep)
        .mockResolvedValueOnce('vscode, claude'); // platforms
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['update'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['author']).toBe('New Author');
      expect(manifest['platforms']).toEqual(['vscode', 'claude']);
      expect(manifest['name']).toBe('my-skill');
    });

    it('removes platforms when user types - on the platforms prompt', async () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({ ...VALID_MANIFEST, platforms: ['vscode'] }),
        'utf8',
      );
      const mockQuestion = jest.fn()
        .mockResolvedValueOnce('') // name
        .mockResolvedValueOnce('') // version
        .mockResolvedValueOnce('') // description
        .mockResolvedValueOnce('') // category
        .mockResolvedValueOnce('') // author
        .mockResolvedValueOnce('') // repository
        .mockResolvedValueOnce('') // keywords
        .mockResolvedValueOnce('') // tags
        .mockResolvedValueOnce('-'); // platforms -- type - to clear
      (createInterface as jest.Mock).mockReturnValue({ question: mockQuestion, close: jest.fn() });

      jest.spyOn(console, 'log').mockImplementation(() => {});
      await createManifestCommand().parseAsync(['update'], { from: 'user' });

      const manifest = JSON.parse(
        fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest['platforms']).toBeUndefined();
    });
  });

  describe('migrate subcommand', () => {
    it('merges aitools.manifest.json into aitools.json', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.manifest.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({ dependencies: { 'other-skill': '^1.0.0' } }),
        'utf8',
      );
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      createManifestCommand().parse(['migrate'], { from: 'user' });
      const merged = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
        name: string;
        dependencies: Record<string, string>;
      };
      expect(merged.name).toBe('my-skill');
      expect(merged.dependencies['other-skill']).toBe('^1.0.0');
    });

    it('errors on conflicting name without --force', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.manifest.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
      fs.writeFileSync(
        path.join(tmp, 'aitools.json'),
        JSON.stringify({ name: 'different-name' }),
        'utf8',
      );
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(() => createManifestCommand().parse(['migrate'], { from: 'user' })).toThrow('process.exit(1)');
      } finally {
        mockExit.mockRestore();
      }
    });
  });
});

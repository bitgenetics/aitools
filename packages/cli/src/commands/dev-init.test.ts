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
import { createDevInitCommand, BUNDLED_NAME, BUNDLED_VERSION } from './dev-init.js';
import { readLockFile, writeLockFile, upsertLockEntry } from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';

describe('dev-init constants', () => {
  it('exports BUNDLED_NAME as create-ai-tool', () => {
    expect(BUNDLED_NAME).toBe('create-ai-tool');
  });

  it('exports a semver BUNDLED_VERSION', () => {
    expect(BUNDLED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('dev-init lock file behaviour', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-dev-init-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('writes a bundled:create-ai-tool resolved entry to the lock file', () => {
    const lock = readLockFile(tmp);
    const entry = {
      version: BUNDLED_VERSION,
      resolved: `bundled:${BUNDLED_NAME}`,
      integrity: '',
      files: [path.join(tmp, 'SKILL.md')],
      installedAt: new Date().toISOString(),
    };
    const updated = upsertLockEntry(lock, BUNDLED_NAME, entry);
    writeLockFile(tmp, updated);

    const result = readLockFile(tmp);
    expect(result.tools[BUNDLED_NAME]).toBeDefined();
    expect(result.tools[BUNDLED_NAME]!.version).toBe(BUNDLED_VERSION);
    expect(result.tools[BUNDLED_NAME]!.resolved).toBe(`bundled:${BUNDLED_NAME}`);
  });
});

describe('dev-init install path', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-dev-init-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('resolves skill install path via ConfigManager', () => {
    const configManager = new ConfigManager(tmp);
    const installBase = configManager.resolveInstallPath('skill', 'project');
    expect(typeof installBase).toBe('string');
    expect(installBase.length).toBeGreaterThan(0);
  });

  it('can write files to the resolved skill directory', () => {
    const configManager = new ConfigManager(tmp);
    const installBase = configManager.resolveInstallPath('skill', 'project');
    const destPath = path.resolve(installBase, `${BUNDLED_NAME}/SKILL.md`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, '# Bundled skill', 'utf8');
    expect(fs.readFileSync(destPath, 'utf8')).toBe('# Bundled skill');
  });
});

describe('dev-init command action', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-dev-init-cmd-'));
    process.chdir(tmp);
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
    jest.restoreAllMocks();
  });

  it('installs bundled create-ai-tool files and updates lock', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createDevInitCommand().parse([], { from: 'user' });

    const lock = readLockFile(tmp);
    expect(lock.tools[BUNDLED_NAME]).toBeDefined();
    for (const file of lock.tools[BUNDLED_NAME]!.files) {
      expect(path.isAbsolute(file)).toBe(false);
      expect(file).not.toContain('\\');
    }
    expect(fs.existsSync(path.join(tmp, 'aitools.json'))).toBe(true);
  });

  it('skips reinstall when already installed without --force', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createDevInitCommand().parse([], { from: 'user' });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    createDevInitCommand().parse([], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('already installed');
  });

  it('exits when scope is invalid', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => createDevInitCommand().parse(['--scope', 'invalid'], { from: 'user' })).toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('installs to cursor skill path when --platform cursor is passed', () => {
    fs.writeFileSync(path.join(tmp, 'aitools.config.json'), '{}', 'utf8');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createDevInitCommand().parse(['--platform', 'cursor'], { from: 'user' });
    expect(fs.existsSync(path.join(tmp, '.cursor', 'skills', BUNDLED_NAME, 'SKILL.md'))).toBe(true);
  });

  it('exits when platform is invalid', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      createDevInitCommand().parse(['--platform', 'not-a-platform'], { from: 'user' }),
    ).toThrow('process.exit:1');
    exitSpy.mockRestore();
  });
});
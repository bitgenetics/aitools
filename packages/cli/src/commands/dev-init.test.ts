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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLockFile, writeLockFile, upsertLockEntry } from '@aitools/core';
import { BUNDLED_NAME, BUNDLED_VERSION } from './dev-init.js';
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
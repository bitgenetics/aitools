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
import { createInitCommand } from './init.js';

describe('init command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-init-'));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
    jest.clearAllMocks();
  });

  it('creates ai-tools.json in the current directory', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createInitCommand().parse([], { from: 'user' });
    expect(fs.existsSync(path.join(tmp, 'ai-tools.json'))).toBe(true);
  });

  it('creates a file with valid JSON', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createInitCommand().parse([], { from: 'user' });
    const raw = fs.readFileSync(path.join(tmp, 'ai-tools.json'), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('does not overwrite an existing ai-tools.json when --force is not given', () => {
    const existing = JSON.stringify({ tools: { 'existing-skill': '^1.0.0' } });
    fs.writeFileSync(path.join(tmp, 'ai-tools.json'), existing, 'utf8');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createInitCommand().parse([], { from: 'user' });
    // File should NOT be overwritten
    const raw = fs.readFileSync(path.join(tmp, 'ai-tools.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(JSON.parse(existing));
  });
});
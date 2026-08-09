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
import { createVersionCommand } from './pkg-version.js';

const VALID_MANIFEST = {
  name: 'version-pkg',
  version: '1.0.0',
  description: 'test',
  category: 'skill',
  files: [{ src: 'index.md', dest: 'index.md' }],
};

describe('createVersionCommand', () => {
  let tmp: string;
  let prevCwd: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-version-cmd-'));
    prevCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('prints the current version when no release is given', () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    createVersionCommand().parse([], { from: 'user' });
    expect(log).toHaveBeenCalledWith('1.0.0');
  });

  it('bumps patch version', () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createVersionCommand().parse(['patch'], { from: 'user' });
    const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
      version: string;
    };
    expect(updated.version).toBe('1.0.1');
  });

  it('bumps minor version', () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createVersionCommand().parse(['minor'], { from: 'user' });
    const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
      version: string;
    };
    expect(updated.version).toBe('1.1.0');
  });

  it('bumps major version', () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createVersionCommand().parse(['major'], { from: 'user' });
    const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
      version: string;
    };
    expect(updated.version).toBe('2.0.0');
  });

  it('sets an explicit semver version', () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createVersionCommand().parse(['3.0.0'], { from: 'user' });
    const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
      version: string;
    };
    expect(updated.version).toBe('3.0.0');
  });

  it('exits when no manifest exists', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code})`);
    });
    try {
      expect(() => createVersionCommand().parse(['patch'], { from: 'user' })).toThrow(
        'process.exit(1)',
      );
    } finally {
      mockExit.mockRestore();
    }
  });
});

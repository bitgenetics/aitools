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
import path from 'node:path';
import {
  assertExclusiveConfigTarget,
  configFilePath,
  resolveConfigWriteTarget,
} from './config-write-target.js';

describe('config-write-target', () => {
  it('defaults to user config', () => {
    expect(resolveConfigWriteTarget({})).toBe('user');
  });

  it('writes to project config when --project is set', () => {
    expect(resolveConfigWriteTarget({ project: true })).toBe('project');
  });

  it('rejects --project and --global together', () => {
    expect(() => assertExclusiveConfigTarget({ project: true, global: true })).toThrow(
      'Use either --project or --global, not both.',
    );
  });

  it('resolves config file paths', () => {
    expect(configFilePath('/repo', 'user')).toMatch(/aitools\.config\.json$/);
    expect(configFilePath('/repo', 'project')).toBe(path.join('/repo', 'aitools.config.json'));
  });
});

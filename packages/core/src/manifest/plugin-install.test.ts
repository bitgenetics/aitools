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
import os from 'node:os';
import path from 'node:path';
import { resolvePluginInstallDir, sanitizePackageDirName } from './plugin-install.js';

describe('sanitizePackageDirName', () => {
  it('replaces slashes in scoped package names', () => {
    expect(sanitizePackageDirName('@team/code-review-plugin')).toBe('@team__code-review-plugin');
  });
});

describe('resolvePluginInstallDir', () => {
  const cwd = path.join(os.tmpdir(), 'my-project');

  it('resolves project scope to .agents/plugins/<pkg>/', () => {
    const dir = resolvePluginInstallDir('project', cwd, '@team/my-plugin');
    expect(dir).toBe(path.resolve(cwd, '.agents', 'plugins', '@team__my-plugin'));
  });

  it('resolves user scope to ~/.aitools/tools/plugins/<pkg>/', () => {
    const dir = resolvePluginInstallDir('user', cwd, 'my-plugin');
    expect(dir).toBe(path.join(os.homedir(), '.aitools', 'tools', 'plugins', 'my-plugin'));
  });

  it('honours a plugins base override', () => {
    const dir = resolvePluginInstallDir('project', cwd, 'my-plugin', '/custom/plugins');
    expect(dir).toBe(path.join('/custom/plugins', 'my-plugin'));
  });
});

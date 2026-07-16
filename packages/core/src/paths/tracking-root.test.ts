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
import { trackingRoot, userToolsRoot } from './tracking-root.js';

const HOME = path.join(path.sep, 'home', 'testuser');
const CWD = path.join(path.sep, 'projects', 'app');

describe('userToolsRoot', () => {
  it('returns ~/.aitools under the given home', () => {
    expect(userToolsRoot(HOME)).toBe(path.join(HOME, '.aitools'));
  });

  it('defaults to os.homedir() when home is omitted', () => {
    expect(userToolsRoot()).toBe(path.join(os.homedir(), '.aitools'));
  });
});

describe('trackingRoot', () => {
  it('returns resolved cwd for project scope', () => {
    expect(trackingRoot('project', CWD, HOME)).toBe(path.resolve(CWD));
  });

  it('returns userToolsRoot for user scope', () => {
    expect(trackingRoot('user', CWD, HOME)).toBe(path.join(HOME, '.aitools'));
  });

  it('defaults home to os.homedir() for user scope', () => {
    expect(trackingRoot('user', CWD)).toBe(path.join(os.homedir(), '.aitools'));
  });
});

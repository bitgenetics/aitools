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
import { createContextCommand } from './context.js';

describe('createContextCommand', () => {
  it('registers the git-style snapshot command set', () => {
    const names = createContextCommand()
      .commands.map((c) => c.name())
      .sort();
    expect(names).toEqual(
      ['clear', 'drop', 'list', 'ls', 'merge', 'pop', 'pull', 'push', 'rename', 'save', 'show', 'stash', 'status', 'switch'].sort(),
    );
  });

  it('does not register the superseded swap commands', () => {
    const names = createContextCommand().commands.map((c) => c.name());
    expect(names).not.toEqual(expect.arrayContaining(['swap', 'restore', 'accept-stay', 'discover', 'capture', 'publish-baseline']));
  });
});

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
import { normalizeCategory } from './category.js';

describe('normalizeCategory', () => {
  it('maps subagent to agent', () => {
    const result = normalizeCategory('subagent');
    expect(result.category).toBe('agent');
    expect(result.deprecatedAlias).toBe(true);
  });

  it('maps prompt to command', () => {
    const result = normalizeCategory('prompt');
    expect(result.category).toBe('command');
    expect(result.deprecatedAlias).toBe(true);
  });

  it('passes through canonical categories unchanged', () => {
    expect(normalizeCategory('hook').category).toBe('hook');
    expect(normalizeCategory('rule').deprecatedAlias).toBe(false);
  });
});

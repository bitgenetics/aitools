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
import { DEFAULT_PLACEMENT_MODE, effectivePlacementMode } from './placement-mode.js';

describe('effectivePlacementMode', () => {
  it('defaults to strict when placementMode is omitted', () => {
    expect(effectivePlacementMode({})).toBe('strict');
  });

  it('defaults to strict when file is undefined', () => {
    expect(effectivePlacementMode(undefined)).toBe('strict');
  });

  it('returns transform when set', () => {
    expect(effectivePlacementMode({ placementMode: 'transform' })).toBe('transform');
  });

  it('returns verbatim when set', () => {
    expect(effectivePlacementMode({ placementMode: 'verbatim' })).toBe('verbatim');
  });

  it('exports strict as DEFAULT_PLACEMENT_MODE', () => {
    expect(DEFAULT_PLACEMENT_MODE).toBe('strict');
  });
});

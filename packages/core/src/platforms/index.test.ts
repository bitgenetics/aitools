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
import { PLATFORM_SPECS, isSpecStale } from './index.js';

// -- Review: vendor specs past their own freshness gate (red until re-verified)

describe('PLATFORM_SPECS freshness', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('has no vendor spec older than the staleness threshold', () => {
    const stale = Object.values(PLATFORM_SPECS)
      .filter((spec) => isSpecStale(spec))
      .map((spec) => `${spec.id} (${spec.lastVerified})`);
    expect(stale).toEqual([]);
  });
});

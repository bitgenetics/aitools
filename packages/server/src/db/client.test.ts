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
const mockEnd = jest.fn().mockResolvedValue(undefined);

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation((config: unknown) => ({
    config,
    end: mockEnd,
  })),
}));

import { describe, it, expect, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import { initPool, getPool, closePool } from './client.js';

describe('db client', () => {
  afterEach(async () => {
    await closePool();
    mockEnd.mockClear();
    jest.mocked(Pool).mockClear();
  });

  it('throws when getPool is called before initPool', () => {
    expect(() => getPool()).toThrow('Database pool not initialized');
  });

  it('creates a pool with initPool and returns it from getPool', () => {
    const pool = initPool('postgres://localhost/test');
    expect(pool).toBe(getPool());
    expect(jest.mocked(Pool)).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: 'postgres://localhost/test' }),
    );
  });

  it('closes the pool and allows re-initialization', async () => {
    initPool('postgres://localhost/test');
    await closePool();
    expect(mockEnd).toHaveBeenCalled();
    expect(() => getPool()).toThrow('Database pool not initialized');
    initPool('postgres://localhost/other');
    expect(getPool()).toBeDefined();
  });
});

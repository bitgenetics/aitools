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
import { Pool } from 'pg';

let _pool: Pool | undefined;

/**
 * Initialize the shared Postgres connection pool.
 * Must be called once at server startup before getPool() is used.
 */
export function initPool(connectionString: string): Pool {
  _pool = new Pool({
    connectionString,
    min: 2,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  return _pool;
}

/**
 * Return the shared pool. Throws if initPool() has not been called.
 */
export function getPool(): Pool {
  if (!_pool) {
    throw new Error('Database pool not initialized. Call initPool() first.');
  }
  return _pool;
}

/**
 * Gracefully shut down the pool (used on server close / tests).
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = undefined;
  }
}

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
import bcrypt from 'bcrypt';
import type { Pool } from 'pg';

const BCRYPT_ROUNDS = 12;

/**
 * Idempotent schema DDL — safe to run on every startup.
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id          SERIAL PRIMARY KEY,
    token_hash  TEXT UNIQUE NOT NULL,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org         TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    expires_at  TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS auth_tokens_user_id_idx ON auth_tokens(user_id);
`;

/**
 * Run the schema migrations against the given pool.
 * All statements are idempotent (CREATE IF NOT EXISTS) so this is safe to
 * call on every startup.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
}

/**
 * Seed an initial admin user driven by SEED_ADMIN_USERNAME and
 * SEED_ADMIN_PASSWORD environment variables. Idempotent — skipped when the
 * username already exists, so safe to call on every startup.
 */
export async function seedAdminUser(pool: Pool): Promise<void> {
  const username = process.env['SEED_ADMIN_USERNAME'];
  const password = process.env['SEED_ADMIN_PASSWORD'];
  if (!username || !password) return;

  const existing = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    [username],
  );
  if ((existing.rowCount ?? 0) > 0) return;

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await pool.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
    [username, passwordHash],
  );
  console.log(`[aitools] Seeded admin user: ${username}`);
}

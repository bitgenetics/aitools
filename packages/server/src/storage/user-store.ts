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
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Pool } from 'pg';
import type { PublisherAuthResult } from '../auth/publisher-auth.js';
import type { IncomingHttpHeaders } from 'node:http';
import { readOrgHeader } from '../env.js';

const BCRYPT_ROUNDS = 12;

export interface User {
  id: number;
  username: string;
  createdAt: Date;
}

export interface TokenRecord {
  id: number;
  org: string;
  description: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface ResolvedToken {
  userId: number;
  username: string;
  org: string;
}

/**
 * DB-backed store for user accounts and auth tokens.
 *
 * Tokens are stored as SHA-256 hashes — only the raw value is returned at
 * creation time and never persisted in plaintext.
 */
export class UserStore {
  constructor(private readonly pool: Pool) {}

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async createUser(username: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await this.pool.query<{ id: number; username: string; created_at: Date }>(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`Failed to create user — INSERT returned no rows`);
    return { id: row.id, username: row.username, createdAt: row.created_at };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.pool.query<{ id: number; username: string; created_at: Date }>(
      'SELECT id, username, created_at FROM users WHERE username = $1',
      [username],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { id: row.id, username: row.username, createdAt: row.created_at };
  }

  /**
   * Validate credentials and return the user record on success, null on failure.
   */
  async loginUser(username: string, password: string): Promise<User | null> {
    const result = await this.pool.query<{
      id: number;
      username: string;
      password_hash: string;
      created_at: Date;
    }>('SELECT id, username, password_hash, created_at FROM users WHERE username = $1', [username]);

    const row = result.rows[0];
    if (!row) return null;

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) return null;

    return { id: row.id, username: row.username, createdAt: row.created_at };
  }

  // ---------------------------------------------------------------------------
  // Tokens
  // ---------------------------------------------------------------------------

  /**
   * Generate a new bearer token for the given user+org.
   * Returns the raw (unhashed) token — this is the only time it is visible.
   */
  async createToken(
    userId: number,
    org: string,
    description?: string,
    expiresAt?: Date | null,
  ): Promise<{ token: string; id: number }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const result = await this.pool.query<{ id: number }>(
      `INSERT INTO auth_tokens (token_hash, user_id, org, description, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tokenHash, userId, org, description ?? null, expiresAt ?? null],
    );
    const created = result.rows[0];
    if (!created) throw new Error(`Failed to create token — INSERT returned no rows`);
    return { token: rawToken, id: created.id };
  }

  /**
   * Look up a raw bearer token and return the resolved identity, or null if
   * the token is invalid or expired.
   */
  async resolveToken(rawToken: string): Promise<ResolvedToken | null> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const result = await this.pool.query<{
      user_id: number;
      username: string;
      org: string;
      expires_at: Date | null;
    }>(
      `SELECT t.user_id, u.username, t.org, t.expires_at
       FROM auth_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1`,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row) return null;
    if (row.expires_at && row.expires_at < new Date()) return null;

    return { userId: row.user_id, username: row.username, org: row.org };
  }

  async listTokens(userId: number): Promise<TokenRecord[]> {
    const result = await this.pool.query<{
      id: number;
      org: string;
      description: string | null;
      created_at: Date;
      expires_at: Date | null;
    }>(
      `SELECT id, org, description, created_at, expires_at
       FROM auth_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      org: row.org,
      description: row.description,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Delete a token by id, scoped to the owning user.
   * Returns true if a row was deleted.
   */
  async deleteToken(id: number, userId: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM auth_tokens WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Request resolution helper
  // ---------------------------------------------------------------------------

  /**
   * Extract a bearer token from request headers and resolve it to a publisher
   * identity. Returns a PublisherAuthResult compatible with the legacy sync path.
   */
  async resolveFromHeaders(headers: IncomingHttpHeaders): Promise<PublisherAuthResult> {
    const auth = headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return { ok: false, statusCode: 401, error: 'Unauthorized' };
    }

    const rawToken = auth.slice('Bearer '.length).trim();
    if (!rawToken) return { ok: false, statusCode: 401, error: 'Unauthorized' };

    const resolved = await this.resolveToken(rawToken);
    if (!resolved) return { ok: false, statusCode: 401, error: 'Unauthorized' };

    // Honor x-aitools-org header when the token covers that org.
    const requestedOrg = readOrgHeader(headers) ?? '';

    if (requestedOrg && requestedOrg !== resolved.org) {
      return {
        ok: false,
        statusCode: 403,
        error: `Token is not authorized for org "${requestedOrg}"`,
      };
    }

    return {
      ok: true,
      publisher: { userId: resolved.username, org: resolved.org },
    };
  }
}

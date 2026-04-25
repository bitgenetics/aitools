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
import type { IncomingHttpHeaders } from 'node:http';
import type { PublisherAuthResult, AuthenticatedPublisher } from '../../auth/publisher-auth.js';

export type AuthMode = 'simple' | 'database' | 'oidc';

// ── Publisher identity ─────────────────────────────────────────────────────

/**
 * Resolves the publisher identity from request headers.
 * Responsible for: bearer token validation, org authorization.
 */
export interface IPublisherAuth {
  /**
   * Resolve the caller's publisher identity.
   * Returns `{ ok: true, publisher }` on success or `{ ok: false, ... }` on failure.
   */
  resolve(headers: IncomingHttpHeaders): Promise<PublisherAuthResult>;
}

// ── Admin identity ─────────────────────────────────────────────────────────

export interface AdminCheckInput {
  headers: IncomingHttpHeaders;
  /** Pre-parsed cookies from the Cookie header. */
  cookies?: Record<string, string>;
}

/**
 * Validates admin access.
 * Supports token-based, session-based, and OIDC-based admin auth.
 */
export interface IAdminAuth {
  /**
   * Return true if the request has admin privileges.
   */
  check(input: AdminCheckInput): Promise<boolean>;

  /**
   * Validate a submitted admin credential (e.g. token) and create a session.
   * Returns the sessionId on success, null on invalid credential.
   * Only required for session-based flows (login form).
   */
  createSession?(credential: string): Promise<string | null>;

  /**
   * Invalidate a session by ID.
   */
  invalidateSession?(sessionId: string): Promise<void>;
}

// ── User management ────────────────────────────────────────────────────────

export interface ManagedUser {
  id: number;
  username: string;
  createdAt: Date;
}

export interface ManagedTokenRecord {
  id: number;
  org: string;
  description: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

/**
 * Full user + token CRUD. Present on 'database' and 'oidc' auth modes.
 * Required for /api/auth/* routes.
 */
export interface IUserManagement {
  createUser(username: string, password: string): Promise<ManagedUser>;
  loginUser(username: string, password: string): Promise<ManagedUser | null>;
  getUserByUsername(username: string): Promise<ManagedUser | null>;
  createToken(
    userId: number,
    org: string,
    description?: string,
    expiresAt?: Date | null,
  ): Promise<{ token: string; id: number }>;
  listTokens(userId: number): Promise<ManagedTokenRecord[]>;
  deleteToken(id: number, userId: number): Promise<boolean>;
}

// ── Combined auth provider ─────────────────────────────────────────────────

/**
 * Top-level auth provider. Compose via createAuthProvider() in index.ts.
 *
 * Mode guide:
 *  - 'simple'   → static tokens + optional admin token (mode 1: local)
 *  - 'database' → pg-backed users + bearer tokens (mode 2: dev/3: production)
 *  - 'oidc'     → external identity provider / SSO (mode 3: production)
 */
export interface IAuthProvider {
  readonly mode: AuthMode;
  readonly publisher: IPublisherAuth;
  readonly admin: IAdminAuth;
  /**
   * Present when mode is 'database' or 'oidc'.
   * Gating this determines whether /api/auth/* routes are registered.
   */
  readonly userManagement?: IUserManagement;
}

// Re-export shared types used by callers
export type { PublisherAuthResult, AuthenticatedPublisher };

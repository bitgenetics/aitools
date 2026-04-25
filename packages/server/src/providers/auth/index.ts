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
export type { IAuthProvider, IPublisherAuth, IAdminAuth, IUserManagement, AdminCheckInput, ManagedUser, ManagedTokenRecord, AuthMode } from './types.js';
export { SimpleAuthProvider } from './simple.js';
export { DatabaseAuthProvider } from './database.js';
export { OidcAuthProvider } from './oidc.js';

import type { IAuthProvider } from './types.js';
import { SimpleAuthProvider } from './simple.js';
import { DatabaseAuthProvider } from './database.js';
import { OidcAuthProvider } from './oidc.js';
import type { PublisherAuthConfig } from '../../auth/publisher-auth.js';
import type { UserStore } from '../../storage/user-store.js';

export type AuthBackend = 'simple' | 'database' | 'oidc';

export interface AuthProviderConfig {
  backend: AuthBackend;
  /** Admin portal token (all backends). */
  adminToken?: string;

  // ── simple backend ──────────────────────────────────────────────────────
  publisherAuthConfig?: PublisherAuthConfig;
  /** Legacy single-token publish auth. */
  publishToken?: string;

  // ── database backend ────────────────────────────────────────────────────
  userStore?: UserStore;

  // ── oidc backend ────────────────────────────────────────────────────────
  oidcIssuer?: string;
  oidcAudience?: string;
  oidcAdminRole?: string;
  oidcOrgClaim?: string;
}

/**
 * Construct an auth provider from configuration.
 *
 * Reads from env vars when called without config:
 *   AUTH_BACKEND=simple|database|oidc  (default: simple)
 *   AI_TOOLS_ADMIN_TOKEN
 *   OIDC_ISSUER / OIDC_AUDIENCE / OIDC_ADMIN_ROLE / OIDC_ORG_CLAIM
 */
export function createAuthProvider(config?: AuthProviderConfig): IAuthProvider {
  const backend =
    config?.backend ??
    (process.env['AUTH_BACKEND'] as AuthBackend | undefined) ??
    'simple';

  const adminToken = config?.adminToken ?? process.env['AI_TOOLS_ADMIN_TOKEN'];

  switch (backend) {
    case 'simple':
      return new SimpleAuthProvider(
        config?.publisherAuthConfig,
        config?.publishToken,
        adminToken,
      );

    case 'database': {
      const userStore = config?.userStore;
      if (!userStore) throw new Error('userStore is required for database auth backend');
      return new DatabaseAuthProvider(userStore, adminToken);
    }

    case 'oidc': {
      const issuer = config?.oidcIssuer ?? process.env['OIDC_ISSUER'];
      const audience = config?.oidcAudience ?? process.env['OIDC_AUDIENCE'];
      if (!issuer) throw new Error('OIDC_ISSUER is required for oidc auth backend');
      if (!audience) throw new Error('OIDC_AUDIENCE is required for oidc auth backend');
      return new OidcAuthProvider(
        issuer,
        audience,
        config?.oidcAdminRole ?? process.env['OIDC_ADMIN_ROLE'],
        config?.oidcOrgClaim ?? process.env['OIDC_ORG_CLAIM'],
      );
    }

    default:
      throw new Error(`Unknown auth backend: "${backend as string}". Valid values: simple, database, oidc`);
  }
}

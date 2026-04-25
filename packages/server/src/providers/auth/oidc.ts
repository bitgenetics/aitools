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
/**
 * OIDC / external auth provider (stub).
 *
 * Supports Auth0, Azure AD, Okta, and any standards-compliant OIDC provider.
 *
 * To activate, install a JWT validation library:
 *   npm install jose
 *
 * Required environment variables:
 *   OIDC_ISSUER          — e.g. "https://yourapp.auth0.com/"
 *   OIDC_AUDIENCE        — API identifier / audience claim
 *   OIDC_ADMIN_ROLE      — role claim value that grants admin access (default: "ai-tools-admin")
 *   OIDC_ORG_CLAIM       — JWT claim that carries the org name (default: "org")
 *
 * Token flow:
 *  1. Client obtains a JWT from the OIDC provider (Auth0, Azure AD, etc.)
 *  2. Client sends the JWT as "Authorization: Bearer <token>" on each request
 *  3. This provider validates the JWT signature via JWKS and checks audience/issuer
 *  4. The "org" claim (configurable) is used as the publisher org
 *  5. The "roles" claim is checked for admin access
 *
 * User management:
 *  In OIDC mode, user creation and token management are handled by the external
 *  IDP. The userManagement property is intentionally undefined. If you need
 *  to sync user records to a local DB, combine OidcAuthProvider with a UserStore
 *  by sub-classing or composing it.
 *
 * TODO: Replace the stub below with a real implementation. Example skeleton:
 *
 * ```typescript
 * import { createRemoteJWKSet, jwtVerify } from 'jose';
 *
 * export class OidcAuthProvider implements IAuthProvider {
 *   private jwks: ReturnType<typeof createRemoteJWKSet>;
 *
 *   constructor(
 *     private readonly issuer: string,
 *     private readonly audience: string,
 *     private readonly adminRole: string = 'ai-tools-admin',
 *     private readonly orgClaim: string = 'org',
 *   ) {
 *     this.jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));
 *   }
 *
 *   readonly publisher: IPublisherAuth = {
 *     resolve: async (headers) => {
 *       const auth = headers['authorization'];
 *       if (!auth?.startsWith('Bearer ')) return { ok: false, statusCode: 401, error: 'Unauthorized' };
 *       const token = auth.slice(7);
 *       try {
 *         const { payload } = await jwtVerify(token, this.jwks, {
 *           issuer: this.issuer,
 *           audience: this.audience,
 *         });
 *         const org = payload[this.orgClaim] as string | undefined;
 *         const sub = payload.sub ?? 'unknown';
 *         if (!org) return { ok: false, statusCode: 403, error: 'Token missing org claim' };
 *         return { ok: true, publisher: { userId: sub, org } };
 *       } catch {
 *         return { ok: false, statusCode: 401, error: 'Invalid token' };
 *       }
 *     },
 *   };
 *
 *   readonly admin: IAdminAuth = {
 *     check: async ({ headers }) => {
 *       // ... validate token and check roles claim for adminRole
 *     },
 *   };
 * }
 * ```
 */

import type {
  IAuthProvider,
  IPublisherAuth,
  IAdminAuth,
  AdminCheckInput,
} from './types.js';
import type { IncomingHttpHeaders } from 'node:http';
import type { PublisherAuthResult } from '../../auth/publisher-auth.js';

export class OidcAuthProvider implements IAuthProvider {
  readonly mode = 'oidc' as const;
  readonly userManagement = undefined;

  constructor(
    private readonly issuer: string,
    private readonly audience: string,
    private readonly adminRole: string = 'ai-tools-admin',
    private readonly orgClaim: string = 'org',
  ) {}

  readonly publisher: IPublisherAuth = {
    resolve: async (_headers: IncomingHttpHeaders): Promise<PublisherAuthResult> => {
      throw new Error(
        `OidcAuthProvider not yet implemented. ` +
          `Install "jose" and follow the instructions in src/providers/auth/oidc.ts. ` +
          `Issuer: ${this.issuer}, Audience: ${this.audience}`,
      );
    },
  };

  readonly admin: IAdminAuth = {
    check: async (_input: AdminCheckInput): Promise<boolean> => {
      throw new Error(
        `OidcAuthProvider not yet implemented. ` +
          `Install "jose" and follow the instructions in src/providers/auth/oidc.ts.`,
      );
    },
  };
}

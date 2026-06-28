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
import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { PublisherAuthConfig } from '../../auth/publisher-auth.js';
import { resolvePublisher } from '../../auth/publisher-auth.js';
import type {
  IAuthProvider,
  IPublisherAuth,
  IAdminAuth,
  AdminCheckInput,
} from './types.js';
import type { PublisherAuthResult } from '../../auth/publisher-auth.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Simple auth provider for local (mode 1) deployments.
 *
 * Publisher auth: static token → user+org mapping from env vars.
 * Admin auth: single admin token + in-memory session cookies.
 * User management: not supported (no database).
 */
export class SimpleAuthProvider implements IAuthProvider {
  readonly mode = 'simple' as const;
  readonly publisher: IPublisherAuth;
  readonly admin: IAdminAuth;
  readonly userManagement = undefined;

  private readonly sessions = new Map<string, number>(); // sessionId → expiry

  constructor(
    publisherAuthConfig?: PublisherAuthConfig,
    /** Single publish token (legacy fallback). */
    publishToken?: string,
    /** Admin token for portal access. */
    adminToken?: string,
  ) {
    const self = this;

    this.publisher = {
      async resolve(headers: IncomingHttpHeaders): Promise<PublisherAuthResult> {
        if (publisherAuthConfig) {
          return resolvePublisher(headers, publisherAuthConfig);
        }
        if (publishToken) {
          const bearer = headers['authorization'];
          if (!bearer || bearer !== `Bearer ${publishToken}`) {
            return { ok: false, statusCode: 401, error: 'Unauthorized' };
          }
          return { ok: true, publisher: { userId: 'anonymous', org: 'default' } };
        }
        // Open / unauthenticated
        return { ok: true, publisher: { userId: 'anonymous', org: 'default' } };
      },
    };

    this.admin = {
      async check(input: AdminCheckInput): Promise<boolean> {
        if (!adminToken) return false;
        // Session cookie
        const sessionId = input.cookies?.['admin_session'];
        if (sessionId) {
          const expiry = self.sessions.get(sessionId);
          if (expiry && Date.now() <= expiry) return true;
          if (expiry) self.sessions.delete(sessionId); // expired
        }
        // Header token
        const header = input.headers['x-admin-token'];
        const token = Array.isArray(header) ? header[0] : header;
        return typeof token === 'string' && token === adminToken;
      },

      async createSession(credential: string): Promise<string | null> {
        if (!adminToken || credential !== adminToken) return null;
        const id = crypto.randomBytes(32).toString('hex');
        self.sessions.set(id, Date.now() + SESSION_TTL_MS);
        return id;
      },

      async invalidateSession(sessionId: string): Promise<void> {
        self.sessions.delete(sessionId);
      },
    };
  }
}

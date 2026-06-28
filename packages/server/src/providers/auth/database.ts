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
import type { UserStore } from '../../storage/user-store.js';
import type {
  IAuthProvider,
  IPublisherAuth,
  IAdminAuth,
  IUserManagement,
  ManagedUser,
  ManagedTokenRecord,
  AdminCheckInput,
} from './types.js';
import type { PublisherAuthResult } from '../../auth/publisher-auth.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Database-backed auth provider for dev (mode 2) and production (mode 3) deployments.
 *
 * Publisher auth: pg-backed bearer tokens via UserStore.
 * Admin auth:     admin token (env) + in-memory session cookies.
 * User management: full CRUD via UserStore.
 */
export class DatabaseAuthProvider implements IAuthProvider {
  readonly mode = 'database' as const;
  readonly publisher: IPublisherAuth;
  readonly admin: IAdminAuth;
  readonly userManagement: IUserManagement;

  private readonly sessions = new Map<string, number>(); // sessionId → expiry

  constructor(
    readonly userStore: UserStore,
    private readonly adminToken?: string,
  ) {
    const self = this;

    this.publisher = {
      async resolve(headers: IncomingHttpHeaders): Promise<PublisherAuthResult> {
        return userStore.resolveFromHeaders(headers);
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
          if (expiry) self.sessions.delete(sessionId);
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

    this.userManagement = {
      async createUser(username: string, password: string): Promise<ManagedUser> {
        return userStore.createUser(username, password);
      },

      async loginUser(username: string, password: string): Promise<ManagedUser | null> {
        return userStore.loginUser(username, password);
      },

      async getUserByUsername(username: string): Promise<ManagedUser | null> {
        return userStore.getUserByUsername(username);
      },

      async createToken(
        userId: number,
        org: string,
        description?: string,
      ): Promise<{ token: string; id: number }> {
        return userStore.createToken(userId, org, description);
      },

      async listTokens(userId: number): Promise<ManagedTokenRecord[]> {
        return userStore.listTokens(userId);
      },

      async deleteToken(id: number, userId: number): Promise<boolean> {
        return userStore.deleteToken(id, userId);
      },
    };
  }
}

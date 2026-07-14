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
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from './app.js';
import type { PublisherAuthResult } from './auth/publisher-auth.js';
import type { IAuthProvider } from './providers/auth/types.js';
import type { UserStore } from './storage/user-store.js';

function createMockUserStore(): jest.Mocked<UserStore> {
  return {
    createUser: jest.fn(),
    getUserByUsername: jest.fn(),
    loginUser: jest.fn(),
    createToken: jest.fn(),
    resolveToken: jest.fn(),
    listTokens: jest.fn(),
    deleteToken: jest.fn(),
    resolveFromHeaders: jest.fn(),
  } as unknown as jest.Mocked<UserStore>;
}

describe('buildApp', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-app-'));
  });

  it('registers auth routes when a userStore is provided', async () => {
    const userStore = createMockUserStore();
    const app = await buildApp({ dataDir: tempDir, userStore, adminToken: 'admin' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'a', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('uses a custom authProvider when supplied', async () => {
    const authProvider: IAuthProvider = {
      mode: 'simple',
      publisher: {
        resolve: jest.fn(async (): Promise<PublisherAuthResult> => ({
          ok: false,
          statusCode: 401,
          error: 'blocked',
        })),
      },
      admin: {
        check: jest.fn(async () => false),
      },
    };

    const app = await buildApp({ dataDir: tempDir, authProvider });
    const res = await app.inject({ method: 'GET', url: '/api/tools' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('masks 500 errors in the global error handler', async () => {
    const app = await buildApp({ dataDir: tempDir, logger: false });
    app.get('/test-boom', async () => {
      throw Object.assign(new Error('secret details'), { statusCode: 500 });
    });

    const res = await app.inject({ method: 'GET', url: '/test-boom' });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.payload).error).toBe('Internal server error');
    await app.close();
  });

  it('returns client error messages from the global error handler', async () => {
    const app = await buildApp({ dataDir: tempDir, logger: false });
    app.get('/test-client-error', async () => {
      throw Object.assign(new Error('bad request details'), { statusCode: 400 });
    });

    const res = await app.inject({ method: 'GET', url: '/test-client-error' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toBe('bad request details');
    await app.close();
  });
});

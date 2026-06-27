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
import { readOrgHeader } from '../env.js';

export interface PublisherIdentity {
  userId: string;
  orgs: string[];
}

export interface PublisherAuthConfig {
  tokens: Record<string, PublisherIdentity>;
}

export interface AuthenticatedPublisher {
  userId: string;
  org: string;
}

export type PublisherAuthResult =
  | { ok: true; publisher: AuthenticatedPublisher }
  | { ok: false; statusCode: 401 | 403; error: string };

/**
 * Resolve a publisher identity from request headers and auth configuration.
 */
export function resolvePublisher(
  headers: IncomingHttpHeaders,
  config: PublisherAuthConfig,
): PublisherAuthResult {
  const auth = headers['authorization'];
  if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return { ok: false, statusCode: 401, error: 'Unauthorized' };
  }

  const token = auth.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, statusCode: 401, error: 'Unauthorized' };
  }

  const identity = config.tokens[token];
  if (!identity) {
    return { ok: false, statusCode: 401, error: 'Unauthorized' };
  }

  if (!Array.isArray(identity.orgs) || identity.orgs.length === 0) {
    return {
      ok: false,
      statusCode: 403,
      error: `User "${identity.userId}" is not a member of any org`,
    };
  }

  const normalizedRequestedOrg = readOrgHeader(headers) ?? '';

  const org =
    normalizedRequestedOrg.length > 0
      ? normalizedRequestedOrg
      : identity.orgs.length === 1
      ? identity.orgs[0]
      : '';

  if (!org) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Multiple org memberships detected. Provide x-aitools-org header.',
    };
  }

  if (!identity.orgs.includes(org)) {
    return {
      ok: false,
      statusCode: 403,
      error: `User "${identity.userId}" is not a member of org "${org}"`,
    };
  }

  return {
    ok: true,
    publisher: {
      userId: identity.userId,
      org,
    },
  };
}

/**
 * Parse JSON auth config from env var AITOOLS_PUBLISHER_TOKENS.
 */
export function parsePublisherAuthConfigFromEnv(
  raw: string | undefined,
): PublisherAuthConfig | undefined {
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid AITOOLS_PUBLISHER_TOKENS JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AITOOLS_PUBLISHER_TOKENS must be a JSON object');
  }

  const tokens = parsed as Record<string, unknown>;
  const normalized: Record<string, PublisherIdentity> = {};

  for (const [token, value] of Object.entries(tokens)) {
    if (!token.trim()) {
      throw new Error('AITOOLS_PUBLISHER_TOKENS contains an empty token key');
    }

    if (!value || typeof value !== 'object') {
      throw new Error(`AITOOLS_PUBLISHER_TOKENS[${token}] must be an object`);
    }

    const userId = (value as { userId?: unknown }).userId;
    const orgs = (value as { orgs?: unknown }).orgs;

    if (typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        `AITOOLS_PUBLISHER_TOKENS[${token}].userId must be a non-empty string`,
      );
    }

    if (!Array.isArray(orgs) || orgs.some((org) => typeof org !== 'string' || !org.trim())) {
      throw new Error(
        `AITOOLS_PUBLISHER_TOKENS[${token}].orgs must be an array of non-empty strings`,
      );
    }

    normalized[token] = {
      userId: userId.trim(),
      orgs: orgs.map((org) => org.trim()),
    };
  }

  return { tokens: normalized };
}
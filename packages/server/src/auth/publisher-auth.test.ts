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
import { describe, it, expect } from '@jest/globals';
import { parsePublisherAuthConfigFromEnv, resolvePublisher } from './publisher-auth.js';

const baseConfig = {
  tokens: {
    single: { userId: 'alice', orgs: ['team-a'] },
    multi: { userId: 'bob', orgs: ['team-a', 'team-b'] },
    emptyOrgs: { userId: 'carol', orgs: [] as string[] },
  },
};

describe('resolvePublisher', () => {
  it('returns 401 when authorization header is missing', () => {
    const result = resolvePublisher({}, baseConfig);
    expect(result).toEqual({ ok: false, statusCode: 401, error: 'Unauthorized' });
  });

  it('returns 401 when bearer token is empty', () => {
    const result = resolvePublisher({ authorization: 'Bearer ' }, baseConfig);
    expect(result).toEqual({ ok: false, statusCode: 401, error: 'Unauthorized' });
  });

  it('returns 401 when token is not configured', () => {
    const result = resolvePublisher({ authorization: 'Bearer unknown' }, baseConfig);
    expect(result).toEqual({ ok: false, statusCode: 401, error: 'Unauthorized' });
  });

  it('returns 403 when user has no org memberships', () => {
    const result = resolvePublisher({ authorization: 'Bearer emptyOrgs' }, baseConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('carol');
    }
  });

  it('resolves the sole org when user belongs to one org', () => {
    const result = resolvePublisher({ authorization: 'Bearer single' }, baseConfig);
    expect(result).toEqual({
      ok: true,
      publisher: { userId: 'alice', org: 'team-a' },
    });
  });

  it('returns 403 when user has multiple orgs and no x-aitools-org header', () => {
    const result = resolvePublisher({ authorization: 'Bearer multi' }, baseConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('x-aitools-org');
    }
  });

  it('uses x-aitools-org when user has multiple org memberships', () => {
    const result = resolvePublisher(
      { authorization: 'Bearer multi', 'x-aitools-org': 'team-b' },
      baseConfig,
    );
    expect(result).toEqual({
      ok: true,
      publisher: { userId: 'bob', org: 'team-b' },
    });
  });

  it('returns 403 when requested org is not in membership list', () => {
    const result = resolvePublisher(
      { authorization: 'Bearer multi', 'x-aitools-org': 'other-org' },
      baseConfig,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('other-org');
    }
  });
});

describe('parsePublisherAuthConfigFromEnv', () => {
  it('returns undefined when env var is unset', () => {
    expect(parsePublisherAuthConfigFromEnv(undefined)).toBeUndefined();
  });

  it('parses valid token mapping JSON', () => {
    const raw = JSON.stringify({
      'my-token': { userId: ' alice ', orgs: [' org-a ', 'org-b'] },
    });
    expect(parsePublisherAuthConfigFromEnv(raw)).toEqual({
      tokens: {
        'my-token': { userId: 'alice', orgs: ['org-a', 'org-b'] },
      },
    });
  });

  it('throws when JSON is invalid', () => {
    expect(() => parsePublisherAuthConfigFromEnv('not-json')).toThrow(
      'Invalid AITOOLS_PUBLISHER_TOKENS JSON',
    );
  });

  it('throws when root value is not an object', () => {
    expect(() => parsePublisherAuthConfigFromEnv('"string"')).toThrow(
      'AITOOLS_PUBLISHER_TOKENS must be a JSON object',
    );
  });

  it('throws when token key is empty', () => {
    expect(() =>
      parsePublisherAuthConfigFromEnv(JSON.stringify({ '': { userId: 'u', orgs: ['o'] } })),
    ).toThrow('empty token key');
  });

  it('throws when entry is not an object', () => {
    expect(() => parsePublisherAuthConfigFromEnv(JSON.stringify({ tok: 'bad' }))).toThrow(
      'AITOOLS_PUBLISHER_TOKENS[tok] must be an object',
    );
  });

  it('throws when userId is missing', () => {
    expect(() =>
      parsePublisherAuthConfigFromEnv(JSON.stringify({ tok: { orgs: ['o'] } })),
    ).toThrow('userId must be a non-empty string');
  });

  it('throws when orgs contains non-string values', () => {
    expect(() =>
      parsePublisherAuthConfigFromEnv(JSON.stringify({ tok: { userId: 'u', orgs: [1] } })),
    ).toThrow('orgs must be an array of non-empty strings');
  });
});

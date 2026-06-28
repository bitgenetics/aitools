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
import { OrgStore, OrgStoreError } from '../storage/org-store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), 'org-store-'));
});

afterEach(() => {
  rmSync(testDir, { recursive: true });
});

describe('OrgStore', () => {
  it('creates and retrieves an org', async () => {
    const store = new OrgStore(testDir);
    const org = await store.createOrg('acme', 'alice');

    expect(org.name).toBe('acme');
    expect(org.createdBy).toBe('alice');
    expect(org.members).toContain('alice');

    const retrieved = await store.getOrg('acme');
    expect(retrieved).toEqual(org);
  });

  it('throws when creating duplicate org', async () => {
    const store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');

    await expect(store.createOrg('acme', 'bob')).rejects.toThrow(
      new OrgStoreError(`Org 'acme' already exists`, 409)
    );
  });

  it('lists all orgs', async () => {
    const store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');
    await store.createOrg('widgets', 'bob');

    const orgs = await store.listOrgs();
    expect(orgs).toHaveLength(2);
    expect(orgs.map(o => o.name)).toEqual(['acme', 'widgets']);
  });

  it('adds member to org', async () => {
    const store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');

    const updated = await store.addMember('acme', 'bob', 'alice');
    expect(updated.members).toEqual(['alice', 'bob']);
  });

  it('throws when adding member to nonexistent org', async () => {
    const store = new OrgStore(testDir);

    await expect(store.addMember('acme', 'bob', 'alice')).rejects.toThrow(
      new OrgStoreError(`Org 'acme' not found`, 404)
    );
  });

  it('throws when adding duplicate member', async () => {
    const store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');

    await expect(store.addMember('acme', 'alice', 'alice')).rejects.toThrow(
      new OrgStoreError(`User 'alice' already member of 'acme'`, 409)
    );
  });

  it('deletes org', async () => {
    const store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');

    await store.deleteOrg('acme', 'alice');
    expect(await store.getOrg('acme')).toBeNull();
  });

  it('throws when deleting nonexistent org', async () => {
    const store = new OrgStore(testDir);

    await expect(store.deleteOrg('acme', 'alice')).rejects.toThrow(
      new OrgStoreError(`Org 'acme' not found`, 404)
    );
  });

  it('logs audit entries', async () => {
    const store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');
    await store.addMember('acme', 'bob', 'alice');

    const log = await store.getAuditLog();
    expect(log).toHaveLength(2);
    expect(log[0]?.action).toBe('create_org');
    expect(log[1]?.action).toBe('add_member');
  });

  it('filters audit log by org', async () => {
    const store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');
    await store.createOrg('widgets', 'bob');

    const log = await store.getAuditLog('acme');
    expect(log).toHaveLength(1);
    expect(log[0]?.orgName).toBe('acme');
  });

  it('persists data across instances', async () => {
    let store = new OrgStore(testDir);
    await store.createOrg('acme', 'alice');

    // Create new instance from same dir
    store = new OrgStore(testDir);
    const org = await store.getOrg('acme');
    expect(org).toBeDefined();
    expect(org!.name).toBe('acme');
  });

  it('stores org metadata', async () => {
    const store = new OrgStore(testDir);
    const org = await store.createOrg('acme', 'alice', { custom: 'data', version: 1 });

    expect(org.metadata).toEqual({ custom: 'data', version: 1 });
  });
});

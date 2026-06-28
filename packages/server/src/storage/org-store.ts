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
import type { IStorageProvider } from '../providers/storage/types.js';
import { LocalStorageProvider } from '../providers/storage/local.js';

/** Org metadata stored on disk */
export interface OrgData {
  name: string;
  createdAt: string;
  createdBy: string;
  members: string[]; // userId list
  metadata?: Record<string, unknown>;
}

/** Audit log entry for admin actions */
export interface AuditLogEntry {
  timestamp: string;
  action: string; // 'create_org', 'add_member', 'generate_token', 'delete_org'
  actor: string;
  orgName?: string;
  userId?: string;
  details?: Record<string, unknown>;
}

export class OrgStoreError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'OrgStoreError';
  }
}

/**
 * Org store backed by an IStorageProvider.
 *
 * Layout: <root>/orgs.json       — all org records
 *         <root>/audit-log.jsonl — audit log, one JSON entry per line
 *
 * Accepts either a dataDir string (convenience; creates a LocalStorageProvider)
 * or an IStorageProvider directly.
 */
export class OrgStore {
  private readonly provider: IStorageProvider;
  private orgs: Map<string, OrgData> = new Map();
  private loaded = false;

  constructor(providerOrDataDir: IStorageProvider | string) {
    this.provider =
      typeof providerOrDataDir === 'string'
        ? new LocalStorageProvider(providerOrDataDir)
        : providerOrDataDir;
  }

  /** Load persisted state. Called automatically before the first operation. */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (await this.provider.exists('orgs.json')) {
      const parsed = JSON.parse(await this.provider.readText('orgs.json')) as Array<[string, OrgData]>;
      this.orgs = new Map(parsed);
    }
  }

  /** Create a new org. Throws if it already exists. */
  async createOrg(
    name: string,
    createdBy: string,
    metadata?: Record<string, unknown>,
  ): Promise<OrgData> {
    await this.ensureLoaded();
    if (this.orgs.has(name)) {
      throw new OrgStoreError(`Org '${name}' already exists`, 409);
    }

    const org: OrgData = {
      name,
      createdAt: new Date().toISOString(),
      createdBy,
      members: [createdBy],
      metadata,
    };

    this.orgs.set(name, org);
    await this.save();
    await this.logAudit('create_org', createdBy, { orgName: name });

    return org;
  }

  /** Get org by name */
  async getOrg(name: string): Promise<OrgData | null> {
    await this.ensureLoaded();
    return this.orgs.get(name) ?? null;
  }

  /** List all orgs */
  async listOrgs(): Promise<OrgData[]> {
    await this.ensureLoaded();
    return Array.from(this.orgs.values());
  }

  /** Add a user to an org. Throws if org doesn't exist or user already member. */
  async addMember(orgName: string, userId: string, addedBy: string): Promise<OrgData> {
    await this.ensureLoaded();
    const org = this.orgs.get(orgName);
    if (!org) throw new OrgStoreError(`Org '${orgName}' not found`, 404);
    if (org.members.includes(userId)) {
      throw new OrgStoreError(`User '${userId}' already member of '${orgName}'`, 409);
    }

    org.members.push(userId);
    await this.save();
    await this.logAudit('add_member', addedBy, { orgName, userId });

    return org;
  }

  /** Delete an org. Throws if not found. */
  async deleteOrg(name: string, deletedBy: string): Promise<void> {
    await this.ensureLoaded();
    if (!this.orgs.has(name)) throw new OrgStoreError(`Org '${name}' not found`, 404);

    this.orgs.delete(name);
    await this.save();
    await this.logAudit('delete_org', deletedBy, { orgName: name });
  }

  /** Get audit log entries (optionally filtered by org). */
  async getAuditLog(orgName?: string): Promise<AuditLogEntry[]> {
    if (!(await this.provider.exists('audit-log.jsonl'))) return [];

    const lines = (await this.provider.readText('audit-log.jsonl')).split('\n').filter(Boolean);
    const entries = lines.map((line) => JSON.parse(line) as AuditLogEntry);
    return orgName ? entries.filter((e) => e.orgName === orgName) : entries;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async logAudit(
    action: string,
    actor: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const entry: AuditLogEntry = { timestamp: new Date().toISOString(), action, actor, ...details };
    await this.provider.append('audit-log.jsonl', JSON.stringify(entry) + '\n');
  }

  private async save(): Promise<void> {
    const data = Array.from(this.orgs.entries());
    await this.provider.write('orgs.json', JSON.stringify(data, null, 2));
  }
}

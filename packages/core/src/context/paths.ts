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
import path from 'node:path';

export const CONTEXT_QUARANTINE_DIR = '.aitools/context-quarantine';
export const CONTEXT_SNAPSHOTS_DIR = '.aitools/context-snapshots';
export const CONTEXT_INVENTORY_FILE = '.aitools/context-inventory.json';
export const CONTEXT_STAY_PROPOSAL_FILE = '.aitools/context-stay-proposal.json';
export const QUARANTINE_MANIFEST_FILE = 'manifest.json';

export function quarantineRoot(projectRoot: string): string {
  return path.join(projectRoot, ...CONTEXT_QUARANTINE_DIR.split('/'));
}

export function quarantineDir(projectRoot: string, id: string): string {
  return path.join(quarantineRoot(projectRoot), id);
}

export function snapshotsRoot(projectRoot: string): string {
  return path.join(projectRoot, ...CONTEXT_SNAPSHOTS_DIR.split('/'));
}

export function inventoryPath(projectRoot: string): string {
  return path.join(projectRoot, ...CONTEXT_INVENTORY_FILE.split('/'));
}

export function stayProposalPath(projectRoot: string): string {
  return path.join(projectRoot, ...CONTEXT_STAY_PROPOSAL_FILE.split('/'));
}

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
import fs from 'node:fs';
import path from 'node:path';
import type { AitoolsJson } from '../types/config.js';
import { readAitoolsJson, writeManifest } from '../manifest/manifest-file.js';
import { normalizeStayList } from './stay.js';
import { stayProposalPath } from './paths.js';

export interface ContextStayProposal {
  generatedAt: string;
  targetProfile?: string;
  /** Paths recommended to stay (project-relative). */
  stay: string[];
  /** Optional judgments per path. */
  judgments?: Array<{
    path: string;
    helpOrHinder: 'help' | 'hinder' | 'neutral';
    dependsOnRemoved?: string[];
    note?: string;
  }>;
}

export function readStayProposal(projectRoot: string): ContextStayProposal | null {
  const file = stayProposalPath(projectRoot);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ContextStayProposal;
}

export function writeStayProposal(projectRoot: string, proposal: ContextStayProposal): void {
  const file = stayProposalPath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(proposal, null, 2) + '\n', 'utf8');
}

/**
 * Merge proposal stay paths into authored `aitools.json` `context.stay`.
 * Returns the updated stay list.
 */
export function acceptStayProposal(projectRoot: string): string[] {
  const proposal = readStayProposal(projectRoot);
  if (!proposal) {
    throw new Error(`No stay proposal at ${stayProposalPath(projectRoot)}`);
  }
  const manifest = (readAitoolsJson(projectRoot) ?? {}) as AitoolsJson;
  const existing = manifest.context?.stay ?? [];
  const merged = normalizeStayList([...existing, ...proposal.stay]);
  const next: AitoolsJson = {
    ...manifest,
    context: {
      ...manifest.context,
      stay: merged,
    },
  };
  writeManifest(projectRoot, next);
  return merged;
}

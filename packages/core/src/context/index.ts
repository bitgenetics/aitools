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

export type {
  ContextSwapMode,
  ContextBaselineConfig,
  ContextProfileConfig,
  AiToolsContextConfig,
  AiMechKind,
  AiMechEntry,
  AiMechInventory,
  QuarantineMove,
  QuarantineManifest,
  ContextLockProfile,
  AiToolsContextLock,
} from './types.js';

export {
  CONTEXT_QUARANTINE_DIR,
  CONTEXT_SNAPSHOTS_DIR,
  CONTEXT_INVENTORY_FILE,
  CONTEXT_STAY_PROPOSAL_FILE,
  quarantineRoot,
  quarantineDir,
  snapshotsRoot,
  inventoryPath,
  stayProposalPath,
} from './paths.js';

export {
  toProjectRel,
  matchStayGlob,
  isStayPath,
  normalizeStayList,
} from './stay.js';

export { discoverAiMech, swappablePaths } from './discover.js';
export type { DiscoverOptions } from './discover.js';

export {
  quarantineFiles,
  restoreQuarantine,
  quarantineExists,
  ensureQuarantineRoot,
} from './quarantine.js';

export { captureContext, readSnapshot, dirtyVsSnapshot } from './capture.js';
export type { ContextSnapshot } from './capture.js';

export {
  dirtyTrackedAiMechPaths,
  assertCleanAiMechTree,
  DirtyTreeError,
} from './dirty.js';

export {
  acceptStayProposal,
  readStayProposal,
  writeStayProposal,
} from './accept-stay.js';
export type { ContextStayProposal } from './accept-stay.js';

export {
  installContextProfileTree,
  removeContextProfileFiles,
} from './profile-install.js';
export type { ContextProfileInstallResult } from './profile-install.js';

export {
  swapContextProfile,
  restoreContext,
  getContextStatus,
} from './swap.js';
export type {
  SwapProfilePackage,
  ContextSwapOptions,
  ContextSwapResult,
  ContextRestoreOptions,
  ContextRestoreResult,
  ContextStatus,
} from './swap.js';

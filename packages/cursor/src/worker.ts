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
import { spawnSync } from 'node:child_process';
import { buildWorkerArgv, formatAgentCommand } from './agent-args.js';
import {
  defaultAgentBin,
  spawnAgentCli,
  type AgentSpawner,
  type LoadWorkspaceOptions,
  type LoadWorkspaceResult,
} from './load.js';
import { parseCodeWorkspaceFile, resolveWorkspaceFolders } from './workspace.js';

export type WorkerWorkspaceOptions = LoadWorkspaceOptions;
export type WorkerWorkspaceResult = LoadWorkspaceResult;

/**
 * Parse a multi-root workspace file and launch (or dry-run) `agent worker`
 * with one `--worker-dir` per folder (first folder = assignment identity).
 */
export function workerWorkspaceFromFile(
  options: WorkerWorkspaceOptions,
): WorkerWorkspaceResult {
  const workspaceFile = options.workspaceFile;
  const agentBin = options.agentBin?.trim() || defaultAgentBin();
  const extraArgs = options.extraArgs ?? [];
  const dryRun = options.dryRun === true;
  const spawn: AgentSpawner = options.spawn ?? spawnSync;

  const doc = parseCodeWorkspaceFile(workspaceFile);
  const folderPaths = resolveWorkspaceFolders(workspaceFile, doc);
  const argv = buildWorkerArgv(folderPaths, extraArgs);
  const commandPreview = formatAgentCommand(agentBin, argv);

  if (dryRun) {
    return { folderPaths, agentBin, argv, commandPreview, dryRun: true };
  }

  const result = spawnAgentCli(agentBin, argv, spawn);

  if (result.error) {
    throw new Error(
      `Failed to start Cursor Agent CLI ("${agentBin}"): ${result.error.message}. ` +
        'Install Cursor CLI and ensure `agent` is on PATH, or pass --agent-bin.',
    );
  }

  return {
    folderPaths,
    agentBin,
    argv,
    commandPreview,
    exitCode: result.status,
    dryRun: false,
  };
}

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
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { buildAgentArgv, formatAgentCommand } from './agent-args.js';
import { parseCodeWorkspaceFile, resolveWorkspaceFolders } from './workspace.js';

export type AgentSpawner = (
  command: string,
  args: string[],
  options: { stdio: 'inherit'; shell: boolean },
) => SpawnSyncReturns<Buffer | string>;

export interface LoadWorkspaceOptions {
  /** Path to a `.code-workspace` file. */
  workspaceFile: string;
  /** Agent binary name or path. Defaults to `AITOOLS_CURSOR_AGENT_BIN` or `agent`. */
  agentBin?: string;
  /** Extra args forwarded to the agent (prompt, --print, etc.). */
  extraArgs?: string[];
  /** When true, do not spawn — return the command that would run. */
  dryRun?: boolean;
  /** Injectable spawn for tests. */
  spawn?: AgentSpawner;
}

export interface LoadWorkspaceResult {
  folderPaths: string[];
  agentBin: string;
  argv: string[];
  commandPreview: string;
  /** Present when the agent was spawned. */
  exitCode?: number | null;
  dryRun: boolean;
}

export function defaultAgentBin(): string {
  return process.env.AITOOLS_CURSOR_AGENT_BIN?.trim() || 'agent';
}

/**
 * Parse a multi-root workspace file and launch (or dry-run) the Cursor Agent CLI
 * with `--workspace` + `--add-dir` for each folder.
 */
export function loadWorkspaceFromFile(options: LoadWorkspaceOptions): LoadWorkspaceResult {
  const workspaceFile = options.workspaceFile;
  const agentBin = options.agentBin?.trim() || defaultAgentBin();
  const extraArgs = options.extraArgs ?? [];
  const dryRun = options.dryRun === true;
  const spawn = options.spawn ?? spawnSync;

  const doc = parseCodeWorkspaceFile(workspaceFile);
  const folderPaths = resolveWorkspaceFolders(workspaceFile, doc);
  const argv = buildAgentArgv(folderPaths, extraArgs);
  const commandPreview = formatAgentCommand(agentBin, argv);

  if (dryRun) {
    return { folderPaths, agentBin, argv, commandPreview, dryRun: true };
  }

  const result = spawn(agentBin, argv, {
    stdio: 'inherit',
    // Windows resolves `agent` via PATH as agent.ps1 / agent.cmd — shell required.
    shell: process.platform === 'win32',
  });

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

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
import { Command } from 'commander';
import chalk from 'chalk';
import { workerWorkspaceFromFile } from '../worker.js';

interface WorkerOptions {
  dryRun?: boolean;
  agentBin?: string;
}

export function createWorkerCommand(): Command {
  return new Command('worker')
    .description(
      'Start a Cursor self-hosted worker from a .code-workspace ' +
        '(each folder → --worker-dir; first folder = assignment identity)',
    )
    .argument('<workspaceFile>', 'Path to a .code-workspace file')
    .argument(
      '[workerArgs...]',
      'Extra arguments forwarded to `agent worker` (e.g. start, --pool, debug). ' +
        'Worker flags may follow the workspace file directly; `--` is optional. ' +
        'Put worker options before the action (start/debug).',
    )
    .option('--dry-run', 'Print the agent worker command without running it')
    .option(
      '--agent-bin <bin>',
      'Cursor Agent binary (default: agent, or AITOOLS_CURSOR_AGENT_BIN)',
    )
    // Forward worker CLI flags (--pool, --name, …) instead of rejecting them.
    .allowUnknownOption(true)
    .action((workspaceFile: string, workerArgs: string[], options: WorkerOptions) => {
      try {
        const result = workerWorkspaceFromFile({
          workspaceFile,
          agentBin: options.agentBin,
          extraArgs: workerArgs,
          dryRun: options.dryRun === true,
        });

        if (result.dryRun) {
          console.log(chalk.dim('Would run:'));
          console.log(result.commandPreview);
          console.log(chalk.dim(`\nWorker dirs (${result.folderPaths.length}):`));
          for (let i = 0; i < result.folderPaths.length; i++) {
            const label = i === 0 ? ' (primary)' : '';
            console.log(`  ${result.folderPaths[i]}${label}`);
          }
          return;
        }

        if (result.exitCode !== 0 && result.exitCode !== null) {
          process.exitCode = result.exitCode;
        }
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exitCode = 1;
      }
    });
}

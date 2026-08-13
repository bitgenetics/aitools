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
    // Prefer workspace-first usage; Commander's default "[options] <file> …"
    // reads like aitools flags must precede the path (they need not).
    .usage('<workspaceFile> [options] [workerArgs...]')
    .argument('<workspaceFile>', 'Path to a .code-workspace file')
    .argument(
      '[workerArgs...]',
      'Forwarded to `agent worker` after the auto-built --worker-dir flags ' +
        '(e.g. --pool, --pool-name hub, start). Put worker flags before the ' +
        'action (start/debug). `--` before workerArgs is optional.',
    )
    .option(
      '--dry-run',
      'aitools only: print the agent worker command without running it',
    )
    .option(
      '--agent-bin <bin>',
      'aitools only: Cursor Agent binary (default: agent, or AITOOLS_CURSOR_AGENT_BIN)',
    )
    .addHelpText(
      'after',
      '\nNotes:\n' +
        '  [options] are aitools flags (--dry-run, --agent-bin); they may appear\n' +
        '  before or after <workspaceFile>. Unknown flags after the file are\n' +
        '  forwarded as workerArgs (not listed under Options above).\n' +
        '\nExamples:\n' +
        '  $ aitools cursor worker my.code-workspace --dry-run start\n' +
        '  $ aitools cursor worker my.code-workspace --pool --pool-name hub start\n' +
        '  $ aitools cursor worker my.code-workspace start\n',
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

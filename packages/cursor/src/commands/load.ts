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
import { loadWorkspaceFromFile } from '../load.js';

interface LoadOptions {
  dryRun?: boolean;
  agentBin?: string;
}

export function createLoadCommand(): Command {
  return new Command('load')
    .description(
      'Load a VS Code/Cursor .code-workspace into the Cursor Agent CLI ' +
        '(first folder → --workspace; others → --add-dir)',
    )
    .argument('<workspaceFile>', 'Path to a .code-workspace file')
    .argument(
      '[agentArgs...]',
      'Extra arguments forwarded to the agent (e.g. --print, prompt). ' +
        'Agent flags may follow the workspace file directly; `--` is optional.',
    )
    .option('--dry-run', 'Print the agent command without running it')
    .option(
      '--agent-bin <bin>',
      'Cursor Agent binary (default: agent, or AITOOLS_CURSOR_AGENT_BIN)',
    )
    // Forward agent CLI flags (--print, --mode, …) instead of rejecting them.
    .allowUnknownOption(true)
    .action((workspaceFile: string, agentArgs: string[], options: LoadOptions) => {
      try {
        const result = loadWorkspaceFromFile({
          workspaceFile,
          agentBin: options.agentBin,
          extraArgs: agentArgs,
          dryRun: options.dryRun === true,
        });

        if (result.dryRun) {
          console.log(chalk.dim('Would run:'));
          console.log(result.commandPreview);
          console.log(chalk.dim(`\nFolders (${result.folderPaths.length}):`));
          for (const folder of result.folderPaths) {
            console.log(`  ${folder}`);
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

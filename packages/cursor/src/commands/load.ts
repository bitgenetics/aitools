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
    // Prefer workspace-first usage; Commander's default "[options] <file> …"
    // reads like aitools flags must precede the path (they need not).
    .usage('<workspaceFile> [options] [agentArgs...]')
    .argument('<workspaceFile>', 'Path to a .code-workspace file')
    .argument(
      '[agentArgs...]',
      'Forwarded to the agent after the auto-built --workspace/--add-dir flags ' +
        '(e.g. --print, prompt). `--` before agentArgs is optional.',
    )
    .option('--dry-run', 'aitools only: print the agent command without running it')
    .option(
      '--agent-bin <bin>',
      'aitools only: Cursor Agent binary (default: agent, or AITOOLS_CURSOR_AGENT_BIN)',
    )
    .addHelpText(
      'after',
      '\nNotes:\n' +
        '  [options] are aitools flags (--dry-run, --agent-bin); they may appear\n' +
        '  before or after <workspaceFile>. Unknown flags after the file are\n' +
        '  forwarded as agentArgs (not listed under Options above).\n' +
        '\nExamples:\n' +
        '  $ aitools cursor load my.code-workspace --dry-run\n' +
        '  $ aitools cursor load my.code-workspace --print "summarize this repo"\n',
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

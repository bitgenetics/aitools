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

/** Cursor self-hosted worker accepts at most this many `--worker-dir` roots. */
export const MAX_WORKER_DIRS = 20;

/**
 * Strip a leading `--` separator that Commander may leave when users write
 * `load ws -- --print …` / `worker ws -- start`.
 */
export function cleanExtraArgs(extraArgs: string[]): string[] {
  if (extraArgs.length > 0 && extraArgs[0] === '--') {
    return extraArgs.slice(1);
  }
  return extraArgs;
}

/**
 * Build argv for the Cursor Agent CLI from resolved workspace folder paths.
 *
 * Cursor's multi-root flag is `--add-dir` (not `--add-path`). The first folder
 * becomes `--workspace`; each remaining folder is appended as `--add-dir`.
 */
export function buildAgentArgv(folderPaths: string[], extraArgs: string[] = []): string[] {
  if (folderPaths.length === 0) {
    throw new Error('At least one workspace folder is required');
  }

  const [primary, ...rest] = folderPaths;
  const argv: string[] = ['--workspace', primary!];
  for (const dir of rest) {
    argv.push('--add-dir', dir);
  }
  argv.push(...cleanExtraArgs(extraArgs));
  return argv;
}

/**
 * Build argv for `agent worker` from resolved workspace folder paths.
 *
 * Every folder becomes a repeatable `--worker-dir` (first = assignment identity).
 * Extra args (e.g. `start`, `--pool`, `debug`) follow the dir flags so worker
 * options stay before the worker subcommand action.
 */
export function buildWorkerArgv(folderPaths: string[], extraArgs: string[] = []): string[] {
  if (folderPaths.length === 0) {
    throw new Error('At least one workspace folder is required');
  }
  if (folderPaths.length > MAX_WORKER_DIRS) {
    throw new Error(
      `Cursor worker accepts at most ${MAX_WORKER_DIRS} --worker-dir roots ` +
        `(got ${folderPaths.length} from the workspace file)`,
    );
  }

  const argv: string[] = ['worker'];
  for (const dir of folderPaths) {
    argv.push('--worker-dir', dir);
  }
  argv.push(...cleanExtraArgs(extraArgs));
  return argv;
}

/**
 * Quote one argument for `cmd.exe` when Node will join argv under `shell: true`.
 * Node does **not** escape the args array in that mode — spaces / metacharacters
 * (and prompts containing `path)` or drive-like tokens) otherwise break the line.
 */
export function quoteWindowsCmdArg(arg: string): string {
  if (arg.length === 0) {
    return '""';
  }
  // Safe unquoted token for cmd.exe word-splitting / metacharacters.
  if (!/[\s"&<>|^%!()]/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/gu, '""')}"`;
}

/** Quote argv for a Windows `shell: true` spawn (cmd.exe). */
export function quoteWindowsCmdArgv(argv: string[]): string[] {
  return argv.map(quoteWindowsCmdArg);
}

/** Format a shell-ish preview of the agent invocation for dry-run output. */
export function formatAgentCommand(agentBin: string, argv: string[]): string {
  const useWin = process.platform === 'win32';
  const parts = [agentBin, ...argv].map((part) => {
    if (useWin) {
      return quoteWindowsCmdArg(part);
    }
    if (/[\s"]/u.test(part)) {
      return `"${part.replace(/"/gu, '\\"')}"`;
    }
    return part;
  });
  return parts.join(' ');
}

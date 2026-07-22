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
  if (extraArgs.length > 0) {
    argv.push(...extraArgs);
  }
  return argv;
}

/** Format a shell-ish preview of the agent invocation for dry-run output. */
export function formatAgentCommand(agentBin: string, argv: string[]): string {
  const parts = [agentBin, ...argv].map((part) => {
    if (/[\s"]/u.test(part)) {
      return `"${part.replace(/"/gu, '\\"')}"`;
    }
    return part;
  });
  return parts.join(' ');
}

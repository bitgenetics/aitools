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
import chalk from 'chalk';
import { PLATFORM_SPECS } from '@bitgenetics/aitools-core';
import type { TargetPlatform } from '@bitgenetics/aitools-core';

/** Shared `-p, --platform` flag description for install-family commands. */
export const PLATFORM_OPTION_DESCRIPTION =
  'Target platform: universal, vscode, claude, cursor, or windsurf';

/**
 * Resolve a CLI `--platform` value to a TargetPlatform, or undefined when omitted.
 * Exits the process when the value is not a known platform.
 */
export function resolvePlatformOption(platform: string | undefined): TargetPlatform | undefined {
  if (platform === undefined) return undefined;
  if (!(platform in PLATFORM_SPECS)) {
    console.error(chalk.red(`Unknown platform: ${platform}`));
    console.error(`  Known platforms: ${Object.keys(PLATFORM_SPECS).join(', ')}`);
    process.exit(1);
  }
  return platform as TargetPlatform;
}

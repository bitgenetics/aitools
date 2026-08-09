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
import { MANIFEST_FILENAME } from '@bitgenetics/aitools-core';
import { bumpManifestVersion, loadPublishManifest } from '../utils/bump-version.js';

/**
 * aitools version [patch|minor|major|<x.y.z>]
 *
 * With no argument: print the current version from aitools.json.
 * With a release argument: bump or set the version (same behaviour as `manifest bump`).
 *
 * File is named pkg-version.ts (not version.ts) so Jest's CLI_VERSION mapper
 * for paths ending in /version.js does not collide.
 */
export function createVersionCommand(): Command {
  return new Command('version')
    .description(`Show or bump the package version in ${MANIFEST_FILENAME}`)
    .argument(
      '[release]',
      'Release type: patch | minor | major, or an explicit version like 1.2.3 (omit to print current)',
    )
    .action((release: string | undefined) => {
      const cwd = process.cwd();

      if (release === undefined) {
        const loaded = loadPublishManifest(cwd);
        if (!loaded.ok) {
          console.error(chalk.red(loaded.error));
          process.exit(1);
        }
        console.log(loaded.doc.version ?? '');
        return;
      }

      const result = bumpManifestVersion(cwd, release);
      if (!result.ok) {
        console.error(chalk.red(result.error));
        process.exit(1);
      }

      console.log(`${chalk.dim(result.previous)} → ${chalk.green(result.next)}`);
    });
}

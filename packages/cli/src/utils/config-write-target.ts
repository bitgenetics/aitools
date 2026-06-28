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
import os from 'node:os';
import path from 'node:path';
import { CONFIG_FILENAME } from '@bitgenetics/aitools-core';

export type ConfigWriteTarget = 'user' | 'project';

export interface ConfigTargetOptions {
  project?: boolean;
  global?: boolean;
}

/** Default: user (~/.aitools.config.json). Use --project for ./aitools.config.json. */
export function resolveConfigWriteTarget(options: ConfigTargetOptions): ConfigWriteTarget {
  return options.project ? 'project' : 'user';
}

export function configFilePath(cwd: string, target: ConfigWriteTarget): string {
  return target === 'user'
    ? path.join(os.homedir(), CONFIG_FILENAME)
    : path.join(cwd, CONFIG_FILENAME);
}

export function assertExclusiveConfigTarget(options: ConfigTargetOptions): void {
  if (options.project && options.global) {
    throw new Error('Use either --project or --global, not both.');
  }
}

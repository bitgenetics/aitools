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
import type { InstallScope } from '../types/tool.js';

/** Convert @scope/name to a safe directory segment (@scope__name). */
export function sanitizePackageDirName(name: string): string {
  return name.replace(/\//g, '__');
}

/**
 * Resolve the install directory for a plugin package (legacy opaque-tree helper).
 * Prefer explode install into category paths; this remains for backward-compatible
 * installPaths overrides and tests only.
 */
export function resolvePluginInstallDir(
  scope: InstallScope,
  cwd: string,
  packageName: string,
  pluginsBaseOverride?: string,
): string {
  const packageDir = sanitizePackageDirName(packageName);
  if (pluginsBaseOverride) {
    const base = pluginsBaseOverride.startsWith('~/')
      ? path.join(os.homedir(), pluginsBaseOverride.slice(2))
      : pluginsBaseOverride;
    return path.join(base, packageDir);
  }
  if (scope === 'project') {
    return path.resolve(cwd, '.agents', 'plugins', packageDir);
  }
  return path.join(os.homedir(), '.aitools', 'tools', 'plugins', packageDir);
}

/** Required platform descriptor path inside a plugin bundle (by nativeFor). */
export const PLUGIN_PLATFORM_DESCRIPTOR: Partial<Record<string, string>> = {
  cursor: '.cursor-plugin/plugin.json',
};

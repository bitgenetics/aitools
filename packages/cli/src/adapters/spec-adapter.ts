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
import type { InstallScope, PlatformSpec, TargetPlatform } from '@bitgenetics/aitools-core';
import type { PlatformAdapter, AdapterFileCategory } from './types.js';
import { resolveFileCategory } from './types.js';

/** Expand a leading `~/` to the user's home directory; other paths are returned as given. */
export function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

/**
 * Adapter whose every path comes from the platform spec's `installPaths`, so the spec
 * is the only place an install location is written down.
 */
export class SpecAdapter implements PlatformAdapter {
  readonly platform: TargetPlatform;

  constructor(protected readonly spec: PlatformSpec) {
    this.platform = spec.id;
  }

  resolveDir(category: AdapterFileCategory, scope: InstallScope, cwd: string): string {
    const entry = this.spec.installPaths[resolveFileCategory(category)];
    const dir = scope === 'project' ? entry?.project : entry?.user;
    if (dir === undefined) {
      throw new Error(`Category "${category}" is not supported on ${this.platform} (${scope} scope)`);
    }
    return this.absolute(dir, scope, cwd);
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    const entry = this.spec.installPaths.mcpConfig;
    if (!entry) throw new Error(`MCP config is not supported on ${this.platform}`);
    return this.absolute(entry[scope], scope, cwd);
  }

  resolveHooksConfig(scope: InstallScope, cwd: string): string | null {
    const entry = this.spec.installPaths.hookConfig;
    return entry ? this.absolute(entry[scope], scope, cwd) : null;
  }

  private absolute(p: string, scope: InstallScope, cwd: string): string {
    return scope === 'project' ? path.resolve(cwd, p) : expandHome(p);
  }
}

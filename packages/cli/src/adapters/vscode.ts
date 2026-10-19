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
import { vscodeSpec } from '@bitgenetics/aitools-core';
import type { InstallScope } from '@bitgenetics/aitools-core';
import { SpecAdapter } from './spec-adapter.js';

/**
 * Paths come from the vscode platform spec in core, except the user-scope MCP config,
 * which is the VS Code profile mcp.json and depends on the operating system.
 */
export class VsCodeAdapter extends SpecAdapter {
  constructor() {
    super(vscodeSpec);
  }

  override resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return super.resolveMcpConfig(scope, cwd);
    return resolveVsCodeUserMcpConfig();
  }
}

/** Absolute path to VS Code user-profile mcp.json (MCP: Open User Configuration). */
export function resolveVsCodeUserMcpConfig(homeDir: string = os.homedir()): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'User', 'mcp.json');
  }
  if (process.platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
  }
  return path.join(homeDir, '.config', 'Code', 'User', 'mcp.json');
}

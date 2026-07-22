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
import fs from 'node:fs';
import path from 'node:path';
import type { ToolFile, ToolManifest } from '../types/tool.js';
import { toProjectRel } from './stay.js';

export interface ContextProfileInstallResult {
  files: string[];
  version: string;
  integrity: string;
  resolved: string;
}

/**
 * Install a context-profile package as a tree overlay into projectRoot.
 * Each file's `dest` is treated as project-relative (verbatim).
 */
export function installContextProfileTree(
  projectRoot: string,
  agentsDir: string,
  manifest: ToolManifest,
  meta: { integrity: string; resolved: string },
): ContextProfileInstallResult {
  if (manifest.category !== 'context-profile') {
    throw new Error(
      `Expected category "context-profile", got "${manifest.category}". ` +
        'Context profiles install as a tree overlay of AI-mech paths only.',
    );
  }
  const root = path.resolve(projectRoot);
  const written: string[] = [];

  for (const file of manifest.files as ToolFile[]) {
    const srcPath = path.join(agentsDir, file.src);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`context-profile missing src file: ${file.src}`);
    }
    const destRel = toProjectRel(file.dest.replace(/^\.\//, ''));
    const destAbs = path.join(root, ...destRel.split('/'));
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(srcPath, destAbs);
    written.push(destRel);
  }

  return {
    files: written,
    version: manifest.version,
    integrity: meta.integrity,
    resolved: meta.resolved,
  };
}

/** Remove previously installed profile files (project-relative paths). */
export function removeContextProfileFiles(projectRoot: string, files: string[]): void {
  const root = path.resolve(projectRoot);
  for (const rel of files) {
    const abs = path.join(root, ...toProjectRel(rel).split('/'));
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      fs.unlinkSync(abs);
    }
  }
}

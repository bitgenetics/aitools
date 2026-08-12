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
 * E2E: aitools cursor load / worker from .code-workspace (dry-run).
 * Product contract: .ai/product-changelog/features.md —
 *   cursor load (multi-root agent from .code-workspace)
 *   cursor worker (multi-root self-hosted worker from .code-workspace)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeE2eProjectDir, rmTmpDir, run } from './test-env.js';

function writeMultiRootWorkspace(root: string): {
  workspaceFile: string;
  folderA: string;
  folderB: string;
} {
  const folderA = path.join(root, 'repo-a');
  const folderB = path.join(root, 'repo-b');
  fs.mkdirSync(folderA);
  fs.mkdirSync(folderB);
  const workspaceFile = path.join(root, 'hub.code-workspace');
  fs.writeFileSync(
    workspaceFile,
    JSON.stringify({ folders: [{ path: 'repo-a' }, { path: 'repo-b' }] }, null, 2) + '\n',
    'utf8',
  );
  return { workspaceFile, folderA: path.resolve(folderA), folderB: path.resolve(folderB) };
}

describe('aitools cursor workspace helpers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeE2eProjectDir('cursor-ws-');
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  it('dry-runs load with --workspace and --add-dir for each folder', () => {
    const { workspaceFile, folderA, folderB } = writeMultiRootWorkspace(tmpDir);

    const out = run(`cursor load "${workspaceFile}" --dry-run`);

    expect(out).toContain('--workspace');
    expect(out).toContain(folderA);
    expect(out).toContain('--add-dir');
    expect(out).toContain(folderB);
  });

  it('dry-runs worker with --worker-dir for each folder and marks the first primary', () => {
    const { workspaceFile, folderA, folderB } = writeMultiRootWorkspace(tmpDir);

    const out = run(`cursor worker "${workspaceFile}" --dry-run start`);

    expect(out).toContain('worker');
    expect(out).toContain('--worker-dir');
    expect(out).toContain(folderA);
    expect(out).toContain(folderB);
    expect(out).toContain(`${folderA} (primary)`);
    expect(out).toContain('start');
  });

  it('forwards worker flags after --worker-dir on dry-run', () => {
    const { workspaceFile } = writeMultiRootWorkspace(tmpDir);

    const out = run(
      `cursor worker "${workspaceFile}" --dry-run --pool --pool-name hub start`,
    );

    expect(out).toContain('--worker-dir');
    expect(out).toContain('--pool');
    expect(out).toContain('--pool-name');
    expect(out).toContain('hub');
    expect(out).toContain('start');
  });

  it('dry-runs load when .code-workspace uses VS Code JSONC trailing commas', () => {
    const folderA = path.join(tmpDir, 'repo-a');
    const folderB = path.join(tmpDir, 'repo-b');
    fs.mkdirSync(folderA);
    fs.mkdirSync(folderB);
    const workspaceFile = path.join(tmpDir, 'hub-jsonc.code-workspace');
    fs.writeFileSync(
      workspaceFile,
      `{
  // multi-root hub
  "folders": [
    { "path": "repo-a" },
    { "path": "repo-b" },
  ],
}
`,
      'utf8',
    );

    const out = run(`cursor load "${workspaceFile}" --dry-run`);

    expect(out).toContain('--workspace');
    expect(out).toContain(path.resolve(folderA));
    expect(out).toContain('--add-dir');
    expect(out).toContain(path.resolve(folderB));
  });
});

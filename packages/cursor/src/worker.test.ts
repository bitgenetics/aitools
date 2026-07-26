// Copyright (C) 2026 Nucleic Logic Studios, LLC
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { workerWorkspaceFromFile } from './worker.js';

describe('workerWorkspaceFromFile', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cursor-worker-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('dry-runs agent worker with --worker-dir for each folder', () => {
    const chip = path.join(tmp, 'chip');
    const tools = path.join(tmp, 'ai-tools');
    fs.mkdirSync(chip);
    fs.mkdirSync(tools);
    const workspaceFile = path.join(tmp, 'hub.code-workspace');
    fs.writeFileSync(
      workspaceFile,
      JSON.stringify({
        folders: [{ path: 'chip' }, { path: 'ai-tools' }],
      }),
      'utf8',
    );

    const result = workerWorkspaceFromFile({
      workspaceFile,
      dryRun: true,
      extraArgs: ['start'],
    });

    expect(result.dryRun).toBe(true);
    expect(result.argv).toEqual([
      'worker',
      '--worker-dir',
      path.resolve(chip),
      '--worker-dir',
      path.resolve(tools),
      'start',
    ]);
    expect(result.commandPreview).toContain('--worker-dir');
    expect(result.commandPreview).toContain('worker');
  });

  it('spawns agent worker when not dry-run', () => {
    const project = path.join(tmp, 'proj');
    fs.mkdirSync(project);
    const workspaceFile = path.join(tmp, 'one.code-workspace');
    fs.writeFileSync(
      workspaceFile,
      JSON.stringify({ folders: [{ path: 'proj' }] }),
      'utf8',
    );

    const spawn = jest.fn().mockReturnValue({ status: 0, error: undefined });
    const result = workerWorkspaceFromFile({
      workspaceFile,
      agentBin: 'agent',
      spawn,
      extraArgs: ['--pool', 'start'],
    });

    expect(spawn).toHaveBeenCalledWith(
      'agent',
      ['worker', '--worker-dir', path.resolve(project), '--pool', 'start'],
      expect.objectContaining({
        stdio: 'inherit',
        shell: process.platform === 'win32',
      }),
    );
    expect(result.exitCode).toBe(0);
  });

  it('throws when the workspace file is missing', () => {
    expect(() =>
      workerWorkspaceFromFile({
        workspaceFile: path.join(tmp, 'missing.code-workspace'),
        dryRun: true,
      }),
    ).toThrow(/not found/);
  });
});

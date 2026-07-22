// Copyright (C) 2026 Nucleic Logic Studios, LLC
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadWorkspaceFromFile } from './load.js';

describe('loadWorkspaceFromFile', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cursor-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('dry-runs an agent command with --workspace and --add-dir', () => {
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

    const result = loadWorkspaceFromFile({
      workspaceFile,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.argv).toEqual([
      '--workspace',
      path.resolve(chip),
      '--add-dir',
      path.resolve(tools),
    ]);
    expect(result.commandPreview).toContain('--add-dir');
  });

  it('spawns the agent when not dry-run', () => {
    const project = path.join(tmp, 'proj');
    fs.mkdirSync(project);
    const workspaceFile = path.join(tmp, 'one.code-workspace');
    fs.writeFileSync(
      workspaceFile,
      JSON.stringify({ folders: [{ path: 'proj' }] }),
      'utf8',
    );

    const spawn = jest.fn().mockReturnValue({ status: 0, error: undefined });
    const result = loadWorkspaceFromFile({
      workspaceFile,
      agentBin: 'agent',
      spawn,
      extraArgs: ['hello'],
    });

    expect(spawn).toHaveBeenCalledWith(
      'agent',
      ['--workspace', path.resolve(project), 'hello'],
      expect.objectContaining({ stdio: 'inherit' }),
    );
    expect(result.exitCode).toBe(0);
  });

  it('throws when the workspace file is missing', () => {
    expect(() =>
      loadWorkspaceFromFile({
        workspaceFile: path.join(tmp, 'missing.code-workspace'),
        dryRun: true,
      }),
    ).toThrow(/not found/);
  });
});

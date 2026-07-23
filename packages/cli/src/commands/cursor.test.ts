// Copyright (C) 2026 Nucleic Logic Studios, LLC
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCursorCommand } from './cursor.js';

describe('createCursorCommand', () => {
  let tmp: string;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cursor-cmd-'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('dry-runs load for a multi-root workspace via aitools cursor', async () => {
    fs.mkdirSync(path.join(tmp, 'a'));
    fs.mkdirSync(path.join(tmp, 'b'));
    const workspaceFile = path.join(tmp, 'hub.code-workspace');
    fs.writeFileSync(
      workspaceFile,
      JSON.stringify({ folders: [{ path: 'a' }, { path: 'b' }] }),
      'utf8',
    );

    const cmd = createCursorCommand();
    await cmd.parseAsync(['load', workspaceFile, '--dry-run'], { from: 'user' });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('--workspace');
    expect(output).toContain('--add-dir');
  });

  it('forwards agent flags without requiring a -- separator', async () => {
    fs.mkdirSync(path.join(tmp, 'a'));
    fs.mkdirSync(path.join(tmp, 'b'));
    const workspaceFile = path.join(tmp, 'hub.code-workspace');
    fs.writeFileSync(
      workspaceFile,
      JSON.stringify({ folders: [{ path: 'a' }, { path: 'b' }] }),
      'utf8',
    );

    const cmd = createCursorCommand();
    await cmd.parseAsync(
      ['load', workspaceFile, '--dry-run', '--print', '--mode', 'ask', 'hello'],
      { from: 'user' },
    );

    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('--print');
    expect(output).toContain('--mode');
    expect(output).toContain('ask');
    expect(output).toContain('hello');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

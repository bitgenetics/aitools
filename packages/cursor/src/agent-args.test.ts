// Copyright (C) 2026 Nucleic Logic Studios, LLC
import {
  buildAgentArgv,
  buildWorkerArgv,
  formatAgentCommand,
  quoteWindowsCmdArg,
  MAX_WORKER_DIRS,
} from './agent-args.js';

describe('buildAgentArgv', () => {
  it('uses --workspace for the first folder and --add-dir for the rest', () => {
    expect(buildAgentArgv(['/a', '/b', '/c'])).toEqual([
      '--workspace',
      '/a',
      '--add-dir',
      '/b',
      '--add-dir',
      '/c',
    ]);
  });

  it('appends extra agent args after the folder flags', () => {
    expect(buildAgentArgv(['/a'], ['--print', 'fix tests'])).toEqual([
      '--workspace',
      '/a',
      '--print',
      'fix tests',
    ]);
  });

  it('strips a leading -- separator from extra args', () => {
    expect(buildAgentArgv(['/a'], ['--', '--print', 'hi'])).toEqual([
      '--workspace',
      '/a',
      '--print',
      'hi',
    ]);
  });

  it('rejects an empty folder list', () => {
    expect(() => buildAgentArgv([])).toThrow(/At least one/);
  });
});

describe('buildWorkerArgv', () => {
  it('emits worker subcommand with --worker-dir for every folder', () => {
    expect(buildWorkerArgv(['/a', '/b', '/c'])).toEqual([
      'worker',
      '--worker-dir',
      '/a',
      '--worker-dir',
      '/b',
      '--worker-dir',
      '/c',
    ]);
  });

  it('appends worker args after the dir flags', () => {
    expect(buildWorkerArgv(['/a'], ['--pool', 'start', '--verbose'])).toEqual([
      'worker',
      '--worker-dir',
      '/a',
      '--pool',
      'start',
      '--verbose',
    ]);
  });

  it('strips a leading -- separator from extra args', () => {
    expect(buildWorkerArgv(['/a'], ['--', 'start'])).toEqual([
      'worker',
      '--worker-dir',
      '/a',
      'start',
    ]);
  });

  it('rejects an empty folder list', () => {
    expect(() => buildWorkerArgv([])).toThrow(/At least one/);
  });

  it('rejects more than MAX_WORKER_DIRS folders', () => {
    const dirs = Array.from({ length: MAX_WORKER_DIRS + 1 }, (_, i) => `/d${i}`);
    expect(() => buildWorkerArgv(dirs)).toThrow(/at most 20/);
  });
});

describe('quoteWindowsCmdArg', () => {
  it('leaves simple tokens unquoted', () => {
    expect(quoteWindowsCmdArg('--add-dir')).toBe('--add-dir');
    expect(quoteWindowsCmdArg('k:\\f-drive\\workspace\\chip')).toBe(
      'k:\\f-drive\\workspace\\chip',
    );
  });

  it('quotes prompts with spaces and parentheses', () => {
    expect(quoteWindowsCmdArg('Check 1) path here')).toBe('"Check 1) path here"');
  });

  it('doubles embedded quotes for cmd.exe', () => {
    expect(quoteWindowsCmdArg('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('formatAgentCommand', () => {
  it('quotes paths that contain spaces', () => {
    expect(formatAgentCommand('agent', ['--workspace', 'C:\\My Project'])).toContain(
      '"C:\\My Project"',
    );
  });
});

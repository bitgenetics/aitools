// Copyright (C) 2026 Nucleic Logic Studios, LLC
import { buildAgentArgv, formatAgentCommand, quoteWindowsCmdArg } from './agent-args.js';

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

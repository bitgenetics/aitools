// Copyright (C) 2026 Nucleic Logic Studios, LLC
import { buildAgentArgv, formatAgentCommand } from './agent-args.js';

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

  it('rejects an empty folder list', () => {
    expect(() => buildAgentArgv([])).toThrow(/At least one/);
  });
});

describe('formatAgentCommand', () => {
  it('quotes paths that contain spaces', () => {
    expect(formatAgentCommand('agent', ['--workspace', 'C:\\My Project'])).toContain(
      '"C:\\My Project"',
    );
  });
});

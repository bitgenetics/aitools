// Copyright (C) 2026 Nucleic Logic Studios, LLC
import path from 'node:path';
import { stripJsonc, parseCodeWorkspaceJson, resolveWorkspaceFolders } from './workspace.js';

describe('stripJsonc', () => {
  it('removes line comments outside strings', () => {
    const raw = '{\n  // comment\n  "folders": []\n}\n';
    expect(stripJsonc(raw)).toContain('"folders"');
    expect(stripJsonc(raw)).not.toContain('comment');
  });

  it('keeps // inside strings', () => {
    expect(stripJsonc('{"url":"https://example.com"}')).toContain('https://example.com');
  });

  it('strips trailing commas and BOM so VS Code JSONC parses', () => {
    const raw = '\uFEFF{\n  "folders": [\n    { "path": "a" },\n  ],\n}\n';
    expect(JSON.parse(stripJsonc(raw))).toEqual({ folders: [{ path: 'a' }] });
  });
});

describe('parseCodeWorkspaceJson', () => {
  it('parses a multi-root workspace with comments', () => {
    const doc = parseCodeWorkspaceJson(`{
      // hub workspace
      "folders": [
        { "path": "chip", "name": "chip" },
        { "path": "../ai-tools" }
      ]
    }`);
    expect(doc.folders).toEqual([
      { path: 'chip', name: 'chip' },
      { path: '../ai-tools' },
    ]);
  });

  it('parses workspace files with trailing commas (VS Code JSONC)', () => {
    const doc = parseCodeWorkspaceJson(`{
      "folders": [
        { "path": "chip", },
        { "path": "../ai-tools" },
      ],
      "settings": {
        "files.exclude": { "**/.git": true, },
      },
    }`);
    expect(doc.folders).toEqual([{ path: 'chip' }, { path: '../ai-tools' }]);
  });

  it('rejects empty folders', () => {
    expect(() => parseCodeWorkspaceJson('{ "folders": [] }')).toThrow(/non-empty/);
  });

  it('rejects missing path', () => {
    expect(() => parseCodeWorkspaceJson('{ "folders": [ { "name": "x" } ] }')).toThrow(/path/);
  });
});

describe('resolveWorkspaceFolders', () => {
  it('resolves relative folder paths against the workspace file directory', () => {
    const workspaceFile = path.join('K:', 'hub', 'chip_agent-hub.code-workspace');
    const resolved = resolveWorkspaceFolders(workspaceFile, {
      folders: [{ path: 'chip' }, { path: '../ai-tools' }],
    });
    expect(resolved[0]).toBe(path.resolve(path.dirname(workspaceFile), 'chip'));
    expect(resolved[1]).toBe(path.resolve(path.dirname(workspaceFile), '../ai-tools'));
  });
});

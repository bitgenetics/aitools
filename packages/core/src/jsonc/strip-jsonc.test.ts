// Copyright (C) 2026 Nucleic Logic Studios, LLC
import { stripJsonc } from './strip-jsonc.js';

describe('stripJsonc', () => {
  it('removes line comments outside strings', () => {
    const raw = '{\n  // comment\n  "folders": []\n}\n';
    expect(JSON.parse(stripJsonc(raw))).toEqual({ folders: [] });
  });

  it('keeps // inside strings', () => {
    expect(JSON.parse(stripJsonc('{"url":"https://example.com"}'))).toEqual({
      url: 'https://example.com',
    });
  });

  it('removes block comments outside strings', () => {
    expect(JSON.parse(stripJsonc('{\n  /* x */\n  "a": 1\n}'))).toEqual({ a: 1 });
  });

  it('strips a UTF-8 BOM', () => {
    expect(JSON.parse(stripJsonc('\uFEFF{"a":1}'))).toEqual({ a: 1 });
  });

  it('strips trailing commas in objects and arrays', () => {
    const raw = `{
      "folders": [
        { "path": "a", },
        { "path": "b" },
      ],
      "settings": {
        "x": true,
      },
    }`;
    expect(JSON.parse(stripJsonc(raw))).toEqual({
      folders: [{ path: 'a' }, { path: 'b' }],
      settings: { x: true },
    });
  });

  it('keeps commas inside strings', () => {
    expect(JSON.parse(stripJsonc('{"msg":"a,b,"}'))).toEqual({ msg: 'a,b,' });
  });

  it('accepts comments plus trailing commas together', () => {
    const raw = `{
      // hub
      "folders": [
        { "path": "chip" }, // primary
      ],
    }`;
    expect(JSON.parse(stripJsonc(raw))).toEqual({
      folders: [{ path: 'chip' }],
    });
  });
});

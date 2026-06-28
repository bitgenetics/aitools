/**
 * Minimal chalk stub for Jest (CJS mode). chalk v5 is pure ESM; this mock
 * provides a chainable proxy that returns the input string unchanged so that
 * unit tests that import chalk-dependent modules can run without errors.
 */
'use strict';

function makeChalk() {
  const fn = (s) => String(s ?? '');
  const handler = {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      return typeof prop === 'string'
        ? Object.assign(makeChalk(), {})
        : fn;
    },
    apply: (_target, _thisArg, args) => String(args[0] ?? ''),
  };
  return new Proxy(fn, handler);
}

const chalk = makeChalk();
module.exports = { default: chalk, __esModule: true };

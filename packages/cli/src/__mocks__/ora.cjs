/**
 * Minimal ora stub for Jest (CJS mode). ora v8 is pure ESM; this mock
 * provides a no-op spinner factory so that unit tests importing ora-
 * dependent modules work without side effects.
 */
'use strict';

function spinner() {
  const self = {
    text: '',
    start: () => self,
    succeed: () => self,
    fail: () => self,
    stop: () => self,
    warn: () => self,
    info: () => self,
  };
  return self;
}

module.exports = { default: spinner, __esModule: true };

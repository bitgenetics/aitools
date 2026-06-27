/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  globalSetup: '<rootDir>/global-setup.cjs',
  globalTeardown: '<rootDir>/global-teardown.cjs',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false,
    },
  },
  // E2e tests hit a real network; give each test file plenty of time
  testTimeout: 30000,
  // Run serially — tests share a single registry instance
  maxWorkers: 1,
};

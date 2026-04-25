/** @type {import('jest').Config} */
module.exports = {
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@ai-tools/core$': '<rootDir>/../core/src/index.ts',
  },
  transform: {
    // Override module to CommonJS so ts-jest does not emit ESM in tests.
    // The production build (packages/cli/tsconfig.json) still targets Node16/ESM.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', isolatedModules: true } }],
  },
};
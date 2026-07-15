/** @type {import('jest').Config} */
module.exports = {
  displayName: '@bitgenetics/aitools-cli',
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^chalk$': '<rootDir>/src/__mocks__/chalk.cjs',
    '^ora$': '<rootDir>/src/__mocks__/ora.cjs',
    '^(.+/version)\\.js$': '<rootDir>/version.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@bitgenetics/aitools-core$': '<rootDir>/../core/src/index.ts',
  },
  transform: {
    // Override module to CommonJS so ts-jest does not emit ESM in tests.
    // The production build (packages/cli/tsconfig.json) still targets Node16/ESM.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', isolatedModules: true } }],
  },
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
    },
  },
};

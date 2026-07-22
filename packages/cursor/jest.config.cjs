/** @type {import('jest').Config} */
module.exports = {
  displayName: '@bitgenetics/aitools-cursor',
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^chalk$': '<rootDir>/src/__mocks__/chalk.cjs',
    '^(.+/version)\\.js$': '<rootDir>/version.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
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

/** @type {import('jest').Config} */
module.exports = {
  displayName: '@bitgenetics/aitools-core',
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
    },
  },
};

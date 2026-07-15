/** @type {import('jest').Config} */
module.exports = {
  displayName: '@bitgenetics/aitools-server',
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@bitgenetics/aitools-core$': '<rootDir>/../core/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/app.ts',
    'src/env.ts',
    'src/auth/**/*.ts',
    'src/db/client.ts',
    'src/providers/auth/{database,simple}.ts',
    'src/providers/storage/local.ts',
    'src/routes/**/*.ts',
    'src/storage/{org-store,tool-store}.ts',
    '!src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/lib/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/test/helpers/setupTests.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts'
  ],
  verbose: true,
  testTimeout: 30000,
  maxWorkers: 1
};
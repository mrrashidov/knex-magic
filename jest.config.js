module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/lib/$1'
    },
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
      'lib/**/*.ts',
      '!lib/**/*.d.ts'
    ]
  };
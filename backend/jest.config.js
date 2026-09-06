/**
 * Unit-test config. Runs `*.spec.ts` under `src/` only — the e2e suite has its
 * own config (`test/jest-e2e.json`) because it needs a live database.
 *
 * `fractional-indexing` ships ESM only, so it must be transformed rather than
 * left in `node_modules` ignore.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  transformIgnorePatterns: ['node_modules/(?!(fractional-indexing)/)'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

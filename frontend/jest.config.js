/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@portal/shared$': '<rootDir>/../shared/src/index.ts',
  },
  // Provide the same build-time constants that vite.config.ts `define` injects,
  // so api.ts compiles correctly under ts-jest (commonjs module).
  globals: {
    __API_BASE_URL__: '',
    'ts-jest': {
      diagnostics: false,
    },
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};

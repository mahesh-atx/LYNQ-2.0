/** @type {import('jest').Config} */
export default {
  // Use ESM
  transform: {},
  
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: ['**/tests/**/*.test.js'],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Coverage settings
  collectCoverageFrom: [
    'server.js',
    '!node_modules/**'
  ],
  
  // Timeout for async tests
  testTimeout: 10000,
  
  // Verbose output
  verbose: true
};

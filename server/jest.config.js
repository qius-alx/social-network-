module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'], // if a setup file is needed
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
};

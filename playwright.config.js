const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser', use: { baseURL: 'http://127.0.0.1:3100', launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}  },
  webServer: { command: 'node server.js', url: 'http://127.0.0.1:3100/api/health', env: { PORT: '3100', DATABASE_PATH: ':memory:' } },
});

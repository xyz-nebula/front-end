import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  globalTimeout: 210_000,
  timeout: 45_000,
  workers: 1,
  expect: {
    timeout: 3_000,
  },
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:5173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
})

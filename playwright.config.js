import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "node tests/e2e/test-server.js",
      url: "http://127.0.0.1:5000/api/health",
      reuseExistingServer: !ci,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        E2E_TEST_AUTH_SECRET: "gg-matchday-e2e-only-secret",
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !ci,
      timeout: 60_000,
      env: {
        VITE_API_URL: "http://127.0.0.1:5000/api",
        VITE_E2E_TEST_AUTH_SECRET: "gg-matchday-e2e-only-secret",
        VITE_E2E_TEST_ROLE: "editor",
        VITE_E2E_TEST_PLAYER_ID: "65a000000000000000000001",
      },
    },
  ],
});

import { defineConfig } from "@playwright/test";
import matchday from "./playwright.config.js";

export default defineConfig({
  ...matchday,
  testDir: "./tests/communities-browser",
  fullyParallel: false,
  webServer: matchday.webServer.map((server, index) => ({
    ...server,
    reuseExistingServer: false,
    env: { ...server.env, ...(index === 0 ? { V42_COMMUNITIES: "true" } : { VITE_V42_COMMUNITIES: "true" }) },
  })),
});

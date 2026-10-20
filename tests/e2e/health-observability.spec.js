import { test, expect } from "@playwright/test";

async function enterMatchday(page) {
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
}

test("admin health view shows live database pings, bounded API observations and honest backup limitations", async ({ page }) => {
  await enterMatchday(page);
  await page.getByRole("button", { name: /Admin/ }).first().click();

  const health = page.locator(".database-health-workspace");
  await expect(health.getByRole("heading", { name: "Database health" })).toBeVisible();
  await expect(health.getByText(/Last successful reading/)).toBeVisible();
  await expect(health.getByRole("heading", { name: "Database connections & providers" })).toBeVisible();
  await expect(health.getByRole("heading", { name: "Last 15 minutes" })).toBeVisible();
  await expect(health.getByText("Core Matchday database")).toBeVisible();
  await expect(health.getByText("Connected", { exact: true }).first()).toBeVisible();
  await expect(health.getByRole("heading", { name: "Workflow evidence" })).toBeVisible();
  await expect(health.getByText("Not connected", { exact: true })).toBeVisible();
  await expect(health.getByText(/does not query GitHub Actions or artifact storage/i)).toBeVisible();
  await expect(health.getByRole("link", { name: "Open backup / restore workflow" })).toHaveAttribute("href", /actions\/workflows\/mongodb-backup\.yml/);

  const bodyText = await health.innerText();
  expect(bodyText).not.toMatch(/mongodb\+srv:\/\/|GEMINI_API_KEY=|BEGIN PRIVATE KEY/);
});

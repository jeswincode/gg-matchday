import { test, expect } from "@playwright/test";

async function stubPublicApi(page) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let body = [];
    if (url.pathname.endsWith("/stats/leaderboard")) {
      body = { leaderboard: [], offensive: [], defensive: [] };
    } else if (url.pathname.endsWith("/stats/awards")) {
      body = { winner: null, awards: [], provisional: true };
    } else if (url.pathname.endsWith("/stats/award-history")) {
      body = { awards: [], years: [] };
    } else if (url.pathname.endsWith("/stats/overview")) {
      body = { players: 0, matches: 0, goals: 0 };
    } else if (url.pathname.endsWith("/calendar")) {
      body = { matches: [] };
    } else if (url.pathname.endsWith("/stats/hall-of-fame")) {
      body = { records: [], awards: [], years: [] };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function enterGuestMatchday(page) {
  await page.goto("/?e2eRole=guest");
  await page.getByRole("button", { name: "Explore as Guest" }).click();
  await expect(page.getByRole("button", { name: "Leaderboard" })).toBeVisible();
}

test("guest can open Matchday and reach the live leaderboard", async ({ page }) => {
  await stubPublicApi(page);
  await enterGuestMatchday(page);
  await page.getByRole("button", { name: "Leaderboard" }).click();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByText("Performance. Contribution. Results.")).toBeVisible();
});

test("mobile viewport keeps primary navigation usable across key tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPublicApi(page);
  await enterGuestMatchday(page);
  const navigation = page.locator(".bottom-nav");
  await expect(navigation).toBeVisible();
  await navigation.getByRole("button", { name: /Players/ }).click();
  await expect(navigation.getByRole("button", { name: /Players/ })).toBeVisible();
  await navigation.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.locator(".bottom-nav")).toBeVisible();
});


test("editor can authenticate and record a match through the real browser and API", async ({ page }) => {
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.getByRole("heading", { name: /Welcome back, Playwright/i })).toBeVisible();
  await page.getByRole("button", { name: /ENTER MATCHDAY/i }).click();

  await page.getByRole("button", { name: /Record/ }).first().click();
  await expect(page.getByRole("heading", { name: "Record a Match" })).toBeVisible();
  await page.getByLabel("Match name").fill("E2E Browser Regression Match");
  await page.getByRole("button", { name: "E2E Player One Side 1" }).click();
  await page.getByRole("button", { name: "E2E Player Two Side 2" }).click();
  await page.getByRole("button", { name: "Save Match" }).click();

  await expect(page.getByText("Match recorded.")).toBeVisible();
  await expect(page.getByText("E2E Browser Regression Match")).toBeVisible();
});

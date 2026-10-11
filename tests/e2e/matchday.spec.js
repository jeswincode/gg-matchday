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

test("mobile welcome screen loads the dedicated 9:16 poster with a clickable embedded CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const poster = page.getByRole("img", { name: /GG Matchday cinematic football poster/i });
  await expect(poster).toBeVisible();
  await expect.poll(async () => {
    const currentSrc = await poster.evaluate(element => element.currentSrc);
    return new URL(currentSrc).pathname;
  }).toBe("/enter-matchday-mobile.png");
  const frame = page.locator(".gg-welcome-poster-frame");
  const frameBounds = await frame.boundingBox();
  const enter = page.getByRole("button", { name: "Enter Matchday" });
  const enterBounds = await enter.boundingBox();
  expect(frameBounds).not.toBeNull();
  expect(enterBounds).not.toBeNull();
  expect(Math.abs(frameBounds.width / frameBounds.height - 9 / 16)).toBeLessThan(0.015);
  expect(enterBounds.width).toBeGreaterThan(200);
  expect(enterBounds.height).toBeGreaterThan(35);
  expect(enterBounds.y).toBeGreaterThan(frameBounds.y + frameBounds.height * 0.76);
  await enter.click();
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
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();

  await page.getByRole("button", { name: /Record/ }).first().click();
  await expect(page.getByRole("heading", { name: "Record a Match" })).toBeVisible();
  await page.getByLabel("Match name").fill("E2E Browser Regression Match");
  await page.getByRole("button", { name: "E2E Player One Side 1" }).click();
  await page.getByRole("button", { name: "E2E Player Two Side 2" }).click();
  await page.getByRole("button", { name: "Save Match" }).click();

  await expect(page.getByText("Match recorded.")).toBeVisible();
  await expect(page.getByText("E2E Browser Regression Match")).toBeVisible();
});

test("Clubs Hub exposes task-based primary tabs and supports mobile swipe navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPublicApi(page);
  await enterGuestMatchday(page);

  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  const clubsApp = page.locator(".clubs-app");
  await expect(clubsApp).toBeVisible();
  await expect(page.getByRole("heading", { name: "Club Hub" })).toBeVisible();

  // Verify natural vertical scrolling while the longer Hub overview is active.
  const nav = page.getByRole("navigation", { name: "Clubs navigation" });
  await expect(page.locator(".clubs-hub-discovery-grid")).toBeVisible();
  const pageHeights = await page.evaluate(() => ({
    content: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }));
  expect(pageHeights.content).toBeGreaterThan(pageHeights.viewport + 50);
  await page.mouse.move(180, 650);
  await page.mouse.wheel(0, 650);
  await expect.poll(() => page.evaluate(() => window.scrollY || document.scrollingElement.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const label of ["Club Hub", "My Club", "Market", "Matches", "Players", "Reviews"]) {
    await expect(nav.getByRole("button", { name: new RegExp(label) })).toBeVisible();
  }

  // A left swipe on non-interactive page content advances one primary tab.
  await clubsApp.evaluate(element => {
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "changedTouches", { value: [{ clientX: 325, clientY: 370 }] });
    element.dispatchEvent(start);
    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 185, clientY: 372 }] });
    element.dispatchEvent(end);
  });
  await expect(nav.locator('[data-primary-tab="myClub"]')).toHaveAttribute("aria-current", "page");

  // Market is a separate first-class destination, not a nested My Club tab.
  await nav.getByRole("button", { name: "Market" }).click();
  await expect(page.getByRole("heading", { name: "Send a signing offer" })).toBeVisible();
  await expect(nav.locator('[data-primary-tab="market"]')).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "Matches" }).click();
  await expect(page.getByRole("heading", { name: "Schedule & fixtures" })).toBeVisible();
  await expect(nav.locator('[data-primary-tab="matches"]')).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "Club Hub" }).click();
  await nav.getByRole("button", { name: "Players" }).click();
  const playersSection = page.locator(".clubs-players-section");
  await expect(playersSection).toBeVisible();
  const subnav = playersSection.getByRole("tablist", { name: "Players sections" });
  await expect(subnav.getByRole("tab", { name: "Discovery" })).toBeVisible();
  await expect(subnav.getByRole("tab", { name: "Player History" })).toBeVisible();

  const viewportWidth = page.viewportSize().width;
  const subnavBounds = await subnav.boundingBox();
  const discoveryBounds = await subnav.getByRole("tab", { name: "Discovery" }).boundingBox();
  const historyBounds = await subnav.getByRole("tab", { name: "Player History" }).boundingBox();
  expect(subnavBounds).not.toBeNull();
  expect(discoveryBounds).not.toBeNull();
  expect(historyBounds).not.toBeNull();
  expect(subnavBounds.x).toBeGreaterThanOrEqual(0);
  expect(subnavBounds.x + subnavBounds.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(discoveryBounds.x).toBeGreaterThanOrEqual(subnavBounds.x);
  expect(historyBounds.x + historyBounds.width).toBeLessThanOrEqual(subnavBounds.x + subnavBounds.width + 1);
});

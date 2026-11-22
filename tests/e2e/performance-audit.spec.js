import { test, expect } from "@playwright/test";
import { completeMobileEntry, enterSignedInMatchday } from "./entry-helpers.js";

async function openGuest(page) {
  await page.goto("/?e2eRole=guest");
  await completeMobileEntry(page);
  await page.getByRole("button", { name: "Explore as Guest" }).click();
  return page.getByRole("navigation", { name: "Matchday tabs" });
}

test("startup loads the stadium video and home loads goal leaders on demand", async ({ page }) => {
  const paths = [];
  page.on("request", request => paths.push(new URL(request.url()).pathname));
  await page.route("**/api/stats/goals", route => route.fulfill({
    json: { records: [{ playerId: "goal-leader", name: "On-demand scorer", goals: 8 }] },
  }));
  const stadiumRequest = page.waitForRequest(request => new URL(request.url()).pathname === "/ggmatchdaybg.mp4");
  await page.goto("/?e2eRole=guest", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".gg-startup")).toBeVisible();
  await stadiumRequest;
  await expect(page.locator("#gg-background-video")).toHaveJSProperty("autoplay", true);
  await completeMobileEntry(page);
  const guestEntry = page.getByRole("button", { name: "Explore as Guest" });
  await expect(guestEntry).toBeVisible();
  await guestEntry.click();

  const overview = page.getByRole("region", { name: "Matchday overview" });
  await expect(overview.getByRole("button", { name: /SEASONS/ })).toBeVisible();
  expect(paths).not.toContain("/api/stats/goals");
  await overview.getByRole("button", { name: /GOALS/ }).click();
  await expect(page.getByRole("dialog", { name: "Goal Leaders" })).toContainText("On-demand scorer");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await overview.getByRole("button", { name: /PLAYERS/ }).click();
  await expect(page).toHaveURL(/tab=players/);
});

test("loading more archived matches keeps earlier pages and skips duplicate reads", async ({ page }) => {
  const archiveRequests = [];
  let overviewReads = 0;
  await page.route(url => url.pathname === "/api/matches" && url.searchParams.has("page"), route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page"));
    archiveRequests.push(pageNumber);
    return route.fulfill({ json: Array.from({ length: 50 }, (_, index) => ({
      _id: pageNumber + "-" + index,
      name: "Archive page " + pageNumber + " match " + index,
      date: "2026-11-18",
      teamA: { score: 0 },
      teamB: { score: 0 },
    })) });
  });
  await page.route("**/api/stats/overview", route => {
    overviewReads += 1;
    return route.fulfill({ json: { players: 0, matches: 150, goals: 0 } });
  });
  const nav = await openGuest(page);
  await nav.getByRole("button", { name: /Record$/ }).click();
  const more = page.getByRole("button", { name: "Load more matches" });
  await expect(more).toBeEnabled();

  // Expire the short API cache so duplicate reads would reach the network.
  await page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 16_000;
  });
  await more.click();
  await expect(page.getByRole("heading", { name: "Archive page 2 match 0" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Archive page 1 match 0" })).toBeVisible();
  expect(archiveRequests).toEqual([1, 2]);
  expect(overviewReads).toBe(1);
});

test("retrying a failed archive read keeps the current list and retries the same page", async ({ page }) => {
  const reads = [];
  await page.route(url => url.pathname === "/api/matches" && url.searchParams.has("page"), route => {
    const number = Number(new URL(route.request().url()).searchParams.get("page"));
    reads.push(number);
    if (number === 2 && reads.length === 2) {
      return route.fulfill({ status: 503, json: { message: "Archive temporarily unavailable." } });
    }
    return route.fulfill({ json: [{
      _id: "archive-" + number, name: "Archive match " + number, date: "2026-11-18",
      teamA: { score: 0 }, teamB: { score: 0 },
    }] });
  });
  await page.route("**/api/stats/overview", route => route.fulfill({ json: { matches: 2 } }));
  const nav = await openGuest(page);
  await nav.getByRole("button", { name: /Record$/ }).click();
  await page.getByRole("button", { name: "Load more matches" }).click();
  await expect(page.getByRole("alert")).toContainText("Archive temporarily unavailable.");
  await expect(page.getByRole("heading", { name: "Archive match 1" })).toBeVisible();
  await page.getByRole("button", { name: "Retry loading matches" }).click();
  await expect(page.getByRole("heading", { name: "Archive match 2" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(reads).toEqual([1, 2, 2]);
});

test("the profile editor saves approved positions without a roster refetch on open", async ({ page }) => {
  let rosterReads = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/players") rosterReads += 1;
  });
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await enterSignedInMatchday(page);
  await page.getByRole("button", { name: "Player Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
  const positions = page.getByRole("group", { name: "Approved positions" });
  await expect(positions).toBeVisible();
  expect(rosterReads).toBe(1);
  const bio = page.getByRole("textbox", { name: "Bio", exact: true });
  await bio.fill("A draft bio");
  await expect(bio).toBeFocused();
  await positions.getByRole("checkbox", { name: "LW", exact: true }).check();

  const saved = page.waitForResponse(response => response.url().endsWith("/players/65a000000000000000000001/preferred-positions")
    && response.request().method() === "PATCH" && response.ok());
  await page.getByRole("button", { name: "Save Preferred Positions" }).click();
  expect((await (await saved).json()).preferredPositions).toContain("LW");
  await expect(page.getByText("Preferred positions updated.")).toBeVisible();
});

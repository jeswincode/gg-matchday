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

test("mobile welcome screen fills the viewport without stretching and any poster tap opens Matchday", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const poster = page.getByRole("img", { name: /GG Matchday cinematic football poster/i });
  await expect(poster).toBeVisible();
  await expect.poll(async () => {
    const currentSrc = await poster.evaluate(element => element.currentSrc);
    return new URL(currentSrc).pathname;
  }).toBe("/enter-matchday-mobile.png");

  const viewport = page.viewportSize();
  const frame = page.locator(".gg-welcome-poster-frame");
  const frameBounds = await frame.boundingBox();
  const enter = page.getByRole("button", { name: "Enter Matchday" });
  const enterBounds = await enter.boundingBox();

  expect(frameBounds).not.toBeNull();
  expect(enterBounds).not.toBeNull();
  expect(Math.abs(frameBounds.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBounds.height - viewport.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(enterBounds.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(enterBounds.height - viewport.height)).toBeLessThanOrEqual(1);
  expect(await poster.evaluate(element => getComputedStyle(element).objectFit)).toBe("cover");
  expect(await poster.evaluate(element => Math.abs(element.naturalWidth / element.naturalHeight - 9 / 16))).toBeLessThan(0.015);
  await expect(page.locator(".gg-welcome-button-visual")).toHaveCount(0);
  expect(await enter.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await enter.evaluate(element => getComputedStyle(element).borderWidth)).toBe("0px");

  // Tap a part of the artwork well away from the former visible CTA.
  await page.mouse.click(viewport.width * 0.88, viewport.height * 0.36);
  await expect(page.getByRole("button", { name: /Leaderboard/ }).first()).toBeVisible();
});

test("Enter key opens Matchday from the welcome screen without requiring a pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter Matchday" })).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Leaderboard/ }).first()).toBeVisible();
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

test("My Club keeps stats and history available when wallet loading fails, then recovers on retry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let walletFailures = 0;
  await page.route(url => new RegExp("^/api/clubs/[a-f0-9]{24}/wallet$").test(new URL(url).pathname), async route => {
    walletFailures += 1;
    if (walletFailures === 1) {
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json", "x-request-id": "e2e-wallet-first-failure" },
        body: JSON.stringify({ message: "The request could not be completed.", requestId: "e2e-wallet-first-failure" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.locator(".clubs-app")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Clubs navigation" });
  await nav.getByRole("button", { name: "My Club" }).click();

  await expect(page.getByRole("heading", { name: "Your individual budget" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /E2E My Club Regression FC/ })).toBeVisible();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText(/Couldn’t load club wallet/i);
  await expect(alert).toContainText("e2e-wallet-first-failure");
  await expect(page.getByRole("heading", { name: "Club timeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry Club data" })).toBeVisible();

  await page.getByRole("button", { name: "Retry Club data" }).click();
  await expect.poll(() => walletFailures).toBeGreaterThanOrEqual(2);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your individual budget" })).toBeVisible();
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

test("mobile Dark and Gold palettes stay aligned across Matchday and Clubs transitions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPublicApi(page);
  await enterGuestMatchday(page);

  const html = page.locator("html");
  const themeSwitch = page.locator(".gg-theme");
  const clubsApp = page.locator(".clubs-app");

  // Dark mode should preserve the Matchday-aligned navy background and controls.
  await themeSwitch.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(clubsApp).toBeVisible();
  await expect(html).toHaveAttribute("data-product-mode", "clubs");
  await expect.poll(() =>
    clubsApp.evaluate(element => getComputedStyle(element).getPropertyValue("--clubs-bg").trim())
  ).toBe("#080d17");

  const darkClubHub = page.getByRole("navigation", { name: "Clubs navigation" })
    .getByRole("button", { name: "Club Hub", exact: true });
  await expect.poll(() =>
    darkClubHub.evaluate(element => getComputedStyle(element).backgroundImage)
  ).toContain("225, 237, 255");
  const darkPageFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(darkPageFitsViewport).toBeTruthy();

  // The destination state switches immediately, but the transition guard lasts 720 ms.
  // Wait for it to clear so this test checks the theme flow, not an intentionally guarded rapid tap.
  await expect(page.locator(".product-mode-transition")).toHaveCount(0);

  // Returning to Matchday must preserve the ability to choose Gold independently.
  await page.getByRole("button", { name: /Matchday/ }).click();
  await expect(html).toHaveAttribute("data-product-mode", "matchday");
  await expect(page.locator(".product-mode-transition")).toHaveCount(0);
  await themeSwitch.getByRole("button", { name: "Gold", exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "golden");
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(clubsApp).toBeVisible();
  await expect(html).toHaveAttribute("data-product-mode", "clubs");
  await expect.poll(() =>
    clubsApp.evaluate(element => getComputedStyle(element).getPropertyValue("--clubs-bg").trim())
  ).toBe("#100e09");

  const goldClubHub = page.getByRole("navigation", { name: "Clubs navigation" })
    .getByRole("button", { name: "Club Hub", exact: true });
  await expect.poll(() =>
    goldClubHub.evaluate(element => getComputedStyle(element).backgroundImage)
  ).toContain("239, 208, 125");
  const goldPageFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(goldPageFitsViewport).toBeTruthy();
});



test("World owner can create a kingdom, review a join request, and approve a member", async ({ page }) => {
  const worldName = "E2E Global Map League " + Date.now();
  const ownerPlayerId = "65a000000000000000000001";
  const applicantPlayerId = "65a000000000000000000002";

  await page.goto("/?e2eRole=editor&e2ePlayerId=" + ownerPlayerId);
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Worlds" }).click();

  await page.getByLabel("World name").fill(worldName);
  await page.getByLabel(/Description/).fill("A browser-tested public football community.");
  const createWorldResponsePromise = page.waitForResponse(response =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname.endsWith("/api/worlds")
  );
  await page.getByRole("button", { name: /Create World/ }).click();
  const createWorldResponse = await createWorldResponsePromise;
  expect(createWorldResponse.status()).toBe(201);
  const createdWorld = await createWorldResponse.json();
  const worldSlug = createdWorld.world.slug;

  await expect(page.getByText(worldName + " has been created. You are its owner.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview " + worldName })).toBeVisible();

  // A second signed-in account requests access to the newly created public World.
  await page.goto("/?e2eRole=viewer&e2ePlayerId=" + applicantPlayerId);
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await expect(page.locator(".account-user")).toContainText("Playwright viewer");
  const membershipStateResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === "GET" &&
      url.pathname.endsWith("/worlds/me");
  });
  await page.getByRole("button", { name: "Worlds" }).click();
  const membershipStateResponse = await membershipStateResponsePromise;
  expect(membershipStateResponse.status()).toBe(200);
  await page.getByRole("button", { name: "Preview " + worldName }).click();
  const joinResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === "POST" &&
      url.pathname.endsWith("/api/worlds/" + worldSlug + "/join-requests");
  }, { timeout: 10000 });
  await page.getByRole("button", { name: "Request membership" }).click();
  const joinResponse = await joinResponsePromise;
  expect(joinResponse.status()).toBe(202);
  const joinData = await joinResponse.json();
  expect(joinData.membership.status).toBe("pending");
  await expect(page.getByText("Your request to join this World has been submitted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Awaiting approval" })).toBeDisabled();
  await expect(page.getByText("Request pending")).toBeVisible();

  // The owner sees only requests for Worlds they administer and approves this one.
  await page.goto("/?e2eRole=editor&e2ePlayerId=" + ownerPlayerId);
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Worlds" }).click();
  await expect(page.getByRole("heading", { name: "Membership requests" })).toBeVisible();
  await page.getByRole("button", { name: "Approve Playwright viewer" }).click();
  await expect(page.getByText("World membership approved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Membership requests" })).toHaveCount(0);

  // The owner can enter the local map and make a versioned facility edit.
  await page.getByRole("button", { name: "Preview " + worldName }).click();
  await page.getByRole("button", { name: "Enter World" }).click();
  await expect(page.getByRole("heading", { name: worldName })).toBeVisible();
  await page.getByRole("button", { name: "Select Central Stadium facility" }).click();
  await page.getByRole("button", { name: "Move east" }).click();
  await expect(page.getByText("Central Stadium placement saved.")).toBeVisible();
  await expect(page.getByText("Grid 26, 25 · Rotation 0° · Level 1")).toBeVisible();
  await page.getByRole("button", { name: "← Global Map" }).click();

  // The applicant's next World load reflects the approved membership.
  await page.goto("/?e2eRole=viewer&e2ePlayerId=" + applicantPlayerId);
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Worlds" }).click();
  await page.getByRole("button", { name: "Preview " + worldName }).click();
  await page.getByRole("button", { name: "Enter World" }).click();
  await expect(page.getByRole("heading", { name: worldName })).toBeVisible();
  await expect(page.getByText("Read-only map access")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move east" })).toHaveCount(0);
});

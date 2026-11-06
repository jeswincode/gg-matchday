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

async function stubWorldApi(page) {
  const playerId = "65a000000000000000000001";
  const layout = {
    width: 1800,
    height: 1200,
    locations: [{
      id: "gg-hq",
      name: "GG Headquarters",
      kind: "headquarters",
      x: 900,
      y: 310,
      description: "The golden heart of Original GG.",
      interior: { rooms: [{ id: "grand-hall", name: "Grand Hall", description: "The community meeting place.", theme: "gold", items: ["golden-doors","community-board"] }] }
    }]
  };
  await page.route("**/api/world/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/world/bootstrap")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        world: { slug: "original-gg", title: "Original GG", version: 2, layout },
        playerId,
        canCreateCharacter: true,
        avatar: { displayName: "E2E Footballer", appearance: { skinTone: "medium", bodyType: "athletic", hairStyle: "short", hairColor: "black", kitPrimary: "black", kitSecondary: "gold", bootColor: "white" }, tutorialComplete: true },
        training: { totals: { pushups: 0, pullups: 0, squats: 0, planks: 0, totalCounts: 0, sessions: 0 }, personalBests: { pushups: 0, pullups: 0, squats: 0, planks: 0 } },
        clubs: [],
        clubGrounds: [],
        residence: null,
        residences: [],
        presence: []
      }) });
      return;
    }
    if (url.pathname.endsWith("/world/interiors/gg-hq")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        interior: { type: "public", name: "GG Headquarters", level: 1, interior: layout.locations[0].interior }
      }) });
      return;
    }
    if (url.pathname.endsWith("/world/presence")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, presence: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
}

async function enterGuestMatchday(page) {
  await page.goto("/?e2eRole=guest");
  await page.getByRole("button", { name: "Explore as Guest" }).click();
  await expect(page.getByRole("button", { name: "Leaderboard" })).toBeVisible();
}

test("signed-in player can enter Original GG and explore a stored HQ interior", async ({ page }) => {
  await stubWorldApi(page);
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  const companion = page.getByRole("button", { name: /Enter Original GG with/ });
  await expect(companion).toBeVisible();
  await companion.click();
  await expect(page.locator(".gg-companion-vortex")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Football City" })).toBeVisible();
  await expect(page.locator(".gg-training-challenge canvas")).toHaveCount(0);
  await expect(page.locator(".gg-world-avatar-preview .gg-player-sprite")).toHaveCount(0);
  await page.getByRole("button", { name: "Open GG Headquarters" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to the clubhouse." })).toBeVisible();
  await expect(page.getByText("THE PLACE WHERE THE COMMUNITY MEETS.")).toBeVisible();
  await expect(page.getByRole("button", { name: /GG Community/ })).toBeVisible();
});

test("Pip-style companion follows Matchday navigation and responds to being picked up", async ({ page }) => {
  await stubWorldApi(page);
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();

  const companion = page.locator(".gg-companion-button");
  const navigation = page.locator(".bottom-nav");
  await expect(companion).toBeVisible();
  await expect(navigation).toBeVisible();

  const isAlignedToActiveTab = async () => {
    const sprite = await companion.boundingBox();
    const active = await navigation.locator("button.active").boundingBox();
    if (!sprite || !active) return Number.POSITIVE_INFINITY;
    return Math.abs(sprite.x + sprite.width / 2 - active.x - active.width / 2);
  };
  await expect.poll(isAlignedToActiveTab, { timeout: 5000 }).toBeLessThan(12);

  const beforeTabChange = await companion.boundingBox();
  await navigation.getByRole("button", { name: /Leaderboard/ }).click();
  await expect(navigation.getByRole("button", { name: /Leaderboard/ })).toHaveClass(/active/);
  // A real walk is visible first; desktop navigation spans more than two sprite-widths.
  await expect(page.locator(".gg-companion.is-moving")).toBeVisible();
  await expect.poll(isAlignedToActiveTab, { timeout: 9000, intervals: [100, 250, 500] }).toBeLessThan(12);
  expect(beforeTabChange).not.toBeNull();

  const before = await companion.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 105, before.y + before.height / 2 - 90, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => {
    const after = await companion.boundingBox();
    if (!after) return 0;
    return Math.hypot(after.x - before.x, after.y - before.y);
  }, { timeout: 2500 }).toBeGreaterThan(55);
});

test("companion action menu supports right-click and opens Original GG", async ({ page }) => {
  await stubWorldApi(page);
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();

  const companion = page.locator(".gg-companion-button");
  await expect(companion).toBeVisible();
  await companion.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Companion actions" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Wave hello" }).click();
  await expect(page.getByText("Hey! Good to see you.")).toBeVisible();

  await companion.click({ button: "right" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Enter Original GG" }).click();
  await expect(page.getByRole("heading", { name: "Football City" })).toBeVisible();
  await page.getByRole("button", { name: /Matchday/ }).click();
  await expect(companion).toBeVisible();
  const homeTabCenter = async () => {
    const sprite = await companion.boundingBox();
    const active = await page.locator(".bottom-nav button.active").boundingBox();
    if (!sprite || !active) return Number.POSITIVE_INFINITY;
    return Math.abs(sprite.x + sprite.width / 2 - active.x - active.width / 2);
  };
  await expect.poll(homeTabCenter, { timeout: 5000 }).toBeLessThan(12);
});

test("companion touch-and-hold opens its action menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubWorldApi(page);
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();

  const companion = page.locator(".gg-companion-button");
  await expect(companion).toBeVisible();
  await companion.evaluate(async (button) => {
    const bounds = button.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, pointerId: 77, pointerType: "touch", button: 0,
      clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2
    }));
    await new Promise((resolve) => window.setTimeout(resolve, 570));
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, pointerId: 77, pointerType: "touch", button: 0,
      clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2
    }));
  });
  await expect(page.getByRole("menu", { name: "Companion actions" })).toBeVisible();
});
test("guest can open Matchday and reach the live leaderboard", async ({ page }) => {
  await stubPublicApi(page);
  await enterGuestMatchday(page);
  await page.getByRole("button", { name: "Leaderboard" }).click();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByText("Performance. Contribution. Results.")).toBeVisible();
});

test("mobile coded entry page fits the viewport and its Matchday button opens the app", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const welcome = page.locator(".gg-welcome-coded-screen");
  await expect(welcome).toBeVisible();
  await expect(page.locator(".gg-welcome-stadium-art")).toBeVisible();
  await expect(page.getByRole("heading", { name: /ENTER MATCHDAY/i })).toBeVisible();
  const viewport = page.viewportSize();
  const frameBounds = await welcome.boundingBox();
  const enter = page.getByRole("button", { name: "Enter Matchday" });
  const enterBounds = await enter.boundingBox();
  expect(frameBounds).not.toBeNull();
  expect(enterBounds).not.toBeNull();
  expect(frameBounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(frameBounds.height).toBeGreaterThanOrEqual(viewport.height - 1);
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewport.width + 1);
  expect(enterBounds.width).toBeLessThan(viewport.width);
  expect(await enter.evaluate(element => getComputedStyle(element).borderRadius)).toBe("4px");
  await enter.click();
  await expect(page.getByRole("button", { name: /Leaderboard/ }).first()).toBeVisible();
});

test("Enter key opens Matchday from the welcome screen without requiring a pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
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
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
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
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
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


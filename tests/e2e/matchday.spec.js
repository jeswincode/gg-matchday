import { test, expect } from "@playwright/test";

async function stubPublicApi(page, leaderboard = []) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let body = [];
    if (url.pathname.endsWith("/stats/leaderboard")) {
      body = { leaderboard, offensive: [], defensive: [] };
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
  await expect(page.locator(".bottom-nav").getByRole("button", { name: "Leaderboard" })).toBeVisible();
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
  }).toBe("/enter-matchday-mobile.webp");

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

test("first visits to all five Matchday tabs keep the shell visible and never show a full-screen loader", async ({ page }) => {
  await stubPublicApi(page);
  await enterGuestMatchday(page);

  const navigation = page.locator(".bottom-nav");
  const shell = page.locator("main.app");
  const topbar = page.locator(".topbar");
  for (const label of ["Record", "Leaderboard", "Calendar", "Players", "Home"]) {
    await navigation.getByRole("button", { name: new RegExp(label + "$") }).click();
    await expect(shell).toBeVisible();
    await expect(topbar).toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(page.getByText("Opening Matchday…")).toHaveCount(0);
    await expect(page.locator(".loading-panel").filter({ hasText: "Opening Matchday" })).toHaveCount(0);
  }
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
  await expect(page.getByText("E2E Browser Regression Match", { exact: true }).first()).toBeVisible();
});

test("My Club keeps stats and history available when wallet loading fails, then recovers on retry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let walletFailures = 0;
  let walletUnavailable = true;
  await page.route(url => new RegExp("^/api/clubs/[a-f0-9]{24}/wallet$").test(new URL(url).pathname), async route => {
    walletFailures += 1;
    if (walletUnavailable) {
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

  await expect(page.getByRole("button", { name: "My Player & Wallet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /E2E My Club Regression FC/ })).toBeVisible();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText(/Couldn’t load club wallet/i);
  await expect(alert).toContainText("e2e-wallet-first-failure");
  await expect(page.getByRole("heading", { name: "Club timeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry Club data" })).toBeVisible();

  walletUnavailable = false;
  await page.getByRole("button", { name: "Retry Club data" }).click();
  await expect.poll(() => walletFailures).toBeGreaterThanOrEqual(2);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("button", { name: "My Player & Wallet" })).toBeVisible();
});

test("Clubs opens on first click without replacing the page with a loading screen", async ({ page }) => {
  await stubPublicApi(page);
  await enterGuestMatchday(page);

  // Track even short-lived fallbacks, not just what remains after the click.
  await page.evaluate(() => {
    window.__clubsEntryFallbackSeen = false;
    window.__clubsEntryObserver = new MutationObserver(() => {
      if (document.body.textContent?.includes("Opening Clubs…")) {
        window.__clubsEntryFallbackSeen = true;
      }
    });
    window.__clubsEntryObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.locator(".clubs-app")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Club Hub" })).toBeVisible();
  expect(await page.evaluate(() => {
    window.__clubsEntryObserver.disconnect();
    return window.__clubsEntryFallbackSeen;
  })).toBe(false);

  await page.getByRole("button", { name: /Matchday/i }).first().click();
  await expect(page.locator("main.app")).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeVisible();
});

test("admin control center keeps distinct workspaces and returns to Matchday", async ({ page }) => {
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: /Admin/ }).first().click();

  const admin = page.getByRole("region", { name: "GG Matchday admin control center" });
  await expect(admin).toBeVisible();
  await expect(admin.getByRole("heading", { name: "Overview" })).toBeVisible();
  const nav = admin.getByRole("navigation", { name: "Administration sections" });
  const narrow = test.info().project.name === "chromium-mobile";
  for (const [name, title] of [
    ["Editor requests", "Editor requests"],
    ["Active editors", "Active editors"],
    ["OVR attributes", "OVR attributes"],
    ["Profile videos", "Profile videos"],
    ["Match audit", "Match audit"],
    ["Rating disputes", "Rating disputes"],
    ["System health", "System health"],
    ["Role permissions", "Role permissions"],
  ]) {
    if (narrow) await admin.getByRole("button", { name: "Open admin sections" }).click();
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(admin.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
    await expect(page.locator("main.app")).toBeVisible();
  }
  const topBack = page.locator(".account-bar").getByRole("button", { name: /Back to Matchday/ });
  await expect(topBack).toBeVisible();
  await topBack.click();
  await expect(page.locator(".account-bar").getByRole("button", { name: /Admin/ })).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeVisible();
  await expect(page.locator(".topbar")).toBeVisible();
});

test("desktop Admin layout aligns with Matchday and the sidebar stays put while content scrolls", async ({ page }) => {
  test.skip(test.info().project.name === "chromium-mobile", "Desktop two-pane layout is replaced with a mobile drawer.");
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: /Admin/ }).first().click();
  const sidebar = page.locator(".admin-sidebar");
  const content = page.locator(".admin-main-content");
  await expect(sidebar).toBeVisible();
  await expect(content).toBeVisible();
  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".topbar").getBoundingClientRect();
    const account = document.querySelector(".account-bar").getBoundingClientRect();
    const workspace = document.querySelector(".admin-workspace").getBoundingClientRect();
    const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
    return { headerLeft: header.left, headerRight: header.right,
      accountLeft: account.left, accountRight: account.right,
      workspaceLeft: workspace.left, workspaceRight: workspace.right,
      sidebarTop: sidebar.top };
  });
  expect(Math.abs(geometry.headerLeft - geometry.workspaceLeft)).toBeLessThan(3);
  expect(Math.abs(geometry.headerRight - geometry.workspaceRight)).toBeLessThan(3);
  expect(Math.abs(geometry.accountLeft - geometry.workspaceLeft)).toBeLessThan(3);
  expect(Math.abs(geometry.accountRight - geometry.workspaceRight)).toBeLessThan(3);
  await content.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(100);
  const sidebarTopAfter = await sidebar.evaluate(node => node.getBoundingClientRect().top);
  expect(Math.abs(sidebarTopAfter - geometry.sidebarTop)).toBeLessThan(3);
  await expect(content.getByText("Made by Jeswin")).toBeVisible();
  await sidebar.getByRole("button", { name: "System health" }).click();
  await expect(content.getByRole("heading", { name: "System health", exact: true })).toBeVisible();
  await expect.poll(() => content.evaluate(node => node.scrollTop)).toBe(0);
});

test("mobile admin navigation opens as a drawer and can return to Matchday", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: /Admin/ }).first().click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const open = page.getByRole("button", { name: "Open admin sections" });
  await open.click();
  await expect(open).toHaveAttribute("aria-expanded", "true");
  const sidebar = page.getByRole("navigation", { name: "Administration sections" });
  await sidebar.getByRole("button", { name: "Active editors" }).click();
  await expect(page.getByRole("heading", { name: "Active editors", exact: true }).first()).toBeVisible();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Matchday", exact: true }).first().click();
  await expect(page.locator(".bottom-nav")).toBeVisible();
});

test("Clubs keeps guest destinations reachable in the mobile dock and supports swipe navigation", async ({ page }) => {
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
  for (const label of ["Club Hub", "Matches", "Players"]) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  for (const label of ["My Club", "My Player", "Betting", "Market", "Reviews"]) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toHaveCount(0);
  }
  expect(await nav.evaluate(element => getComputedStyle(element).position)).toBe("fixed");
  await page.evaluate(() => window.scrollTo({ top: 140, behavior: "instant" }));
  const hubScroll = await page.evaluate(() => window.scrollY);
  expect(hubScroll).toBeGreaterThan(0);
  await nav.getByRole("button", { name: "Matches" }).click();
  await nav.getByRole("button", { name: "Club Hub" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(hubScroll);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

  // Check the visible preview during a native drag, before releasing it.
  const pager = clubsApp.locator(".swipe-pager");
  const touch = await nativeTouch(page);
  await touch("touchStart", 325, 370);
  await touch("touchMove", 265, 371);
  await touch("touchMove", 185, 372);
  await expect(pager.locator('[data-pane="next"]')).toBeVisible();
  await touch("touchEnd");
  await expect(page.getByRole("heading", { name: "Schedule & fixtures" })).toBeVisible();
  await expect(nav.locator('[data-primary-tab="matches"]')).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/view=clubs&tab=matches/);
  await page.goBack();
  await expect(nav.locator('[data-primary-tab="overview"]')).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(nav.locator('[data-primary-tab="matches"]')).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "Club Hub" }).click();
  await nav.getByRole("button", { name: "Players" }).click();
  const playersSection = page.locator(".clubs-players-section");
  await expect(playersSection).toBeVisible();
  await expect(playersSection.getByRole("searchbox", { name: "Find a player" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Player History" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Clubs navigation" })
    .getByRole("button", { name: "Players", exact: true })).toHaveAttribute("aria-current", "page");
});

async function nativeTouch(page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  return (type, x, y) => session.send("Input.dispatchTouchEvent", {
    type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
  });
}

test("Matchday keeps the next panel ready during a deep page swipe and resets the scroll on arrival", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPublicApi(page);
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/stats/calendar" && response.ok()),
    enterGuestMatchday(page),
  ]);
  const pager = page.locator("#matchday-pager");
  const nextPane = pager.locator('[data-pane="next"]');
  const navigation = page.getByRole("navigation", { name: "Matchday tabs" });
  const background = page.locator("#gg-background-video");
  await expect(nextPane).toBeHidden();
  await expect(nextPane).toHaveCSS("display", "flow-root");
  await expect(background).toHaveJSProperty("autoplay", true);
  await pager.evaluate(element => window.scrollBy({ top: element.getBoundingClientRect().top + 320, behavior: "instant" }));
  await expect.poll(() => pager.evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(0);
  const homeScroll = await page.evaluate(() => window.scrollY);
  const touch = await nativeTouch(page);
  await touch("touchStart", 320, 470);
  await touch("touchMove", 250, 476);
  await touch("touchMove", 135, 482);
  await expect(pager).toHaveAttribute("data-swiping", "next");
  await expect(nextPane.getByRole("heading", { name: "Recent Matches", includeHidden: true })).toBeVisible();
  await expect(navigation).toBeInViewport();
  await expect(navigation).toHaveCSS("bottom", "0px");
  await expect(background).toHaveJSProperty("paused", true);
  await expect(background).toHaveJSProperty("autoplay", false);
  await touch("touchEnd");
  await expect(pager.locator('[data-pane="current"]').getByRole("heading", { name: "Recent Matches" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: /Record$/ })).toHaveAttribute("aria-current", "page");
  await expect(background).toHaveJSProperty("autoplay", true);
  await expect.poll(() => pager.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(-2);
  await expect(page).toHaveURL(/tab=record/);
  await page.goBack();
  await expect(navigation.getByRole("button", { name: /Home$/ })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(homeScroll);
  await page.goForward();
  await expect(navigation.getByRole("button", { name: /Record$/ })).toHaveAttribute("aria-current", "page");
  await page.reload();
  await page.getByRole("button", { name: "Explore as Guest" }).click();
  await expect(navigation.getByRole("button", { name: /Record$/ })).toHaveAttribute("aria-current", "page");
});

test("a short swipe can start on a leaderboard player or a calendar button without activating it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPublicApi(page, [{ playerId: "first", name: "Swipe Test Player", position: "ST", ggRating: 7.29 }]);
  await enterGuestMatchday(page);
  const nav = page.locator(".bottom-nav");
  const touch = await nativeTouch(page);
  const header = await page.locator(".topbar h1").boundingBox();
  const headerY = Math.round(header.y + header.height / 2);
  for (let i = 0; i < 2; i++) {
    await touch("touchStart", 315, headerY);
    await touch("touchMove", 270, headerY + 4);
    await touch("touchMove", 218, headerY + 9);
    await touch("touchEnd");
  }
  const rank = page.locator(".gg-leaderboard-table").getByRole("button", { name: "Swipe Test Player" });
  await rank.evaluate(button => button.scrollIntoView({ block: "center", behavior: "instant" }));
  await rank.click({ trial: true });
  const player = await rank.boundingBox();
  await rank.evaluate(button => button.addEventListener("click", () => { document.body.dataset.rankTapped = "true"; }));
  const x = Math.round(player.x + player.width * .6);
  const y = Math.round(player.y + player.height / 2);
  await touch("touchStart", x, y);
  await touch("touchMove", x - 30, y + 4);
  await touch("touchMove", x - 62, y + 8);
  await expect(page.locator("#matchday-pager")).toHaveAttribute("data-swiping", "next");
  await touch("touchEnd");
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toHaveAttribute("data-rank-tapped", "true");

  const dayNumber = (await page.locator(".calendar-day:enabled:not(.selected-day)").nth(10).innerText()).trim();
  const day = page.locator(".calendar-grid").getByRole("button", { name: dayNumber, exact: true });
  await day.scrollIntoViewIfNeeded();
  const date = await day.boundingBox();
  const dayX = Math.round(date.x + date.width / 2);
  const dayY = Math.round(date.y + date.height / 2);
  await touch("touchStart", dayX, dayY);
  await touch("touchMove", dayX - 35, dayY + 7);
  await touch("touchMove", dayX - 72, dayY + 13);
  await touch("touchEnd");
  await expect(page.locator("#matchday-pager > [data-pane=current]")).toHaveAttribute("data-tab", "players");
  await nav.getByRole("button", { name: "Calendar" }).click();
  await expect(day).not.toHaveClass(/selected-day/);
  await day.click();
  await expect(day).toHaveClass(/selected-day/);
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

  // Compare the selected theme after the mode transition has settled.
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


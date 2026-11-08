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
      interior: { rooms: [{ id: "grand-hall", name: "Grand Hall", description: "The community meeting place.", theme: "gold", items: [] }] }
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

test("unlinked viewer cannot enter Original GG from the companion menu", async ({ page }) => {
  await page.goto("/?e2eRole=viewer");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  const companion = page.locator(".gg-companion-button");
  await expect(companion).toBeVisible();
  await companion.click({ button: "right" });
  const companionMenu = page.getByRole("menu", { name: "Companion actions" });
  await expect(companionMenu).toBeVisible();
  const worldEntry = companionMenu.getByRole("menuitem", { name: /verified linked Gmail required/i });
  await expect(worldEntry).toBeDisabled();
});

test("signed-in player can enter Original GG and explore a stored HQ interior", async ({ page }) => {
  await stubWorldApi(page);
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  const companion = page.locator(".gg-companion-button");
  await expect(companion).toBeVisible();
  await companion.click({ button: "right" });
  const companionMenu = page.getByRole("menu", { name: "Companion actions" });
  await expect(companionMenu).toBeVisible();
  await companionMenu.getByRole("menuitem", { name: "Enter Original GG" }).click();
  await expect(page.locator(".gg-companion-vortex")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Football City" })).toBeVisible();
  await expect(page.locator(".gg-training-challenge canvas")).toHaveCount(0);
  await expect(page.locator(".gg-world-avatar-preview .gg-player-sprite")).toHaveCount(0);
  await page.getByRole("button", { name: "Open GG Headquarters" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to the clubhouse." })).toBeVisible();
  await expect(page.getByText("THE PLACE WHERE THE COMMUNITY MEETS.")).toBeVisible();
  await expect(page.locator(".gg-room-character-speech p")).toBeVisible();
  await expect(page.locator(".gg-room-character text")).toHaveCount(0);
  const roomDialogue = page.locator("[data-testid='room-character-dialogue'] p");
  await page.locator('.gg-room-scene-svg [data-room-item="club banners"]').evaluate(element => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(roomDialogue).toHaveText("Hear that? That's the supporters.");
  await expect(roomDialogue).toHaveText("Every badge has a story.", { timeout: 3500 });
  await expect(roomDialogue).toHaveText("Give them something to sing about.", { timeout: 6500 });
  await expect(page.getByRole("button", { name: /GG Community/ })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const walkRight = page.getByRole("button", { name: "Walk right" });
  await expect(walkRight).toBeVisible();
  const roomCharacter = page.locator(".gg-room-character");
  const beforeWalk = await roomCharacter.getAttribute("transform");
  await walkRight.click();
  await expect.poll(() => roomCharacter.getAttribute("transform")).not.toBe(beforeWalk);
});

test("Pip keeps its profile home, scrubs the glass nav, and walks with tab dialogue", async ({ page }) => {
  await stubWorldApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?e2eRole=editor&e2ePlayerId=65a000000000000000000001");
  await expect(page.locator(".gg-welcome-coded-screen")).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();

  const companion = page.locator(".gg-companion-button");
  const companionStage = page.locator(".gg-companion");
  const navigation = page.locator(".bottom-nav");
  const accountBar = page.locator(".account-bar");
  const profileAnchor = page.locator(".gg-account-avatar-trigger");
  await expect(companion).toBeVisible();
  await expect(navigation).toBeVisible();
  await expect(profileAnchor).toBeVisible();

  const isCenteredOn = async (surface) => {
    const sprite = await companion.boundingBox();
    const target = await surface.boundingBox();
    if (!sprite || !target) return Number.POSITIVE_INFINITY;
    return Math.abs(sprite.x + sprite.width / 2 - target.x - target.width / 2);
  };
  const profileFootGap = async () => {
    const canvas = await companion.locator("canvas.gg-player-sprite").boundingBox();
    const anchor = await profileAnchor.boundingBox();
    if (!canvas || !anchor) return Number.POSITIVE_INFINITY;
    const seatedFootBottom = canvas.y + canvas.height * (30 / 32);
    const seatTop = anchor.y + anchor.height * 0.5;
    return Math.abs(seatedFootBottom - seatTop);
  };

  // Pip starts seated on the permanent top-left account/profile anchor.
  await expect.poll(() => isCenteredOn(profileAnchor), { timeout: 5000 }).toBeLessThan(12);
  await expect(companionStage).toHaveClass(/is-profile-perched/);
  await expect(companionStage).toHaveAttribute("data-gg-ground", "profile");
  await expect.poll(profileFootGap, { timeout: 5000 }).toBeLessThan(2);
  await expect(companion.locator("canvas.gg-player-sprite")).toHaveAttribute("aria-label", /seated, facing down/);

  const accountBoxBefore = await accountBar.boundingBox();
  const profileBoxBefore = await profileAnchor.boundingBox();

  // Switching a tab must not wake Pip from the profile perch or move the
  // account/profile shelf with the horizontally-swiping tab content.
  const leaderboardTab = navigation.getByRole("button", { name: /Leaderboard/ });
  await leaderboardTab.click();
  await expect(leaderboardTab).toHaveClass(/active/);
  await expect(companionStage).toHaveAttribute("data-gg-ground", "profile");
  await expect(companionStage).toHaveClass(/is-profile-perched/);
  await expect.poll(() => isCenteredOn(profileAnchor), { timeout: 3000 }).toBeLessThan(12);
  const accountBoxAfter = await accountBar.boundingBox();
  const profileBoxAfter = await profileAnchor.boundingBox();
  expect(Math.abs(accountBoxAfter.y - accountBoxBefore.y)).toBeLessThan(1);
  expect(Math.abs(profileBoxAfter.x - profileBoxBefore.x)).toBeLessThan(1);
  expect(Math.abs(profileBoxAfter.y - profileBoxBefore.y)).toBeLessThan(1);

  // The glass capsule tracks the hand continuously, but tab content does not
  // change until pointer-up, just like a native scrubber.
  const playersTab = navigation.getByRole("button", { name: /Players/ });
  const from = await leaderboardTab.boundingBox();
  const to = await playersTab.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  const initialOffset = await navigation.evaluate((element) => element.style.getPropertyValue("--gg-active-offset"));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const middleX = (from.x + to.x + to.width) / 2;
  await page.mouse.move(middleX, from.y + from.height / 2, { steps: 5 });
  await expect(navigation).toHaveAttribute("data-dragging", "true");
  await expect(leaderboardTab).toHaveClass(/active/);
  const middleOffset = await navigation.evaluate((element) => element.style.getPropertyValue("--gg-active-offset"));
  expect(middleOffset).not.toBe(initialOffset);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await expect(leaderboardTab).toHaveClass(/active/);
  await page.mouse.up();
  await expect(playersTab).toHaveClass(/active/);
  await expect(companionStage).toHaveAttribute("data-gg-ground", "profile");
  await expect(companionStage).toHaveClass(/is-profile-perched/);

  // Only a direct Pip tap leaves the home perch.
  await companion.click();
  await expect(companionStage).toHaveAttribute("data-gg-phase", "jumping", { timeout: 1000 });
  await expect(companionStage).not.toHaveClass(/is-profile-perched/, { timeout: 1000 });
  await expect.poll(() => companionStage.getAttribute("data-gg-ground"), { timeout: 3500 }).not.toBe("profile");
  await expect(companionStage).toHaveAttribute("data-gg-phase", "idle", { timeout: 4000 });

  // A tab change now carries a spoken line while Pip jumps onto the rail.
  const calendarTab = navigation.getByRole("button", { name: /Calendar/ });
  await calendarTab.click();
  await expect(calendarTab).toHaveClass(/active/);
  await expect(companionStage).toHaveAttribute("data-gg-bubble-open", "true", { timeout: 2500 });
  await expect(companionStage).toHaveAttribute("data-gg-bubble", "Any big fixtures coming up?");
  await expect(companionStage).toHaveAttribute("data-gg-ground", "nav", { timeout: 4000 });

  // Once Pip is on the rail, the next tab change is a walk rather than a snap.
  await expect(companionStage).toHaveAttribute("data-gg-phase", "idle", { timeout: 4000 });
  await leaderboardTab.click();
  await expect(leaderboardTab).toHaveClass(/active/);
  await expect(companionStage).toHaveAttribute("data-gg-phase", "walking", { timeout: 1500 });
  await expect(companionStage).toHaveAttribute("data-gg-bubble", "Who's climbing the table today?");
  await expect(companionStage).toHaveAttribute("data-gg-ground", "nav", { timeout: 4000 });

  // Dragging Pip back over the profile icon restores the seated home perch.
  const before = await companion.boundingBox();
  const profileBounds = await profileAnchor.boundingBox();
  expect(before).not.toBeNull();
  expect(profileBounds).not.toBeNull();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(profileBounds.x + profileBounds.width / 2, profileBounds.y + profileBounds.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(companionStage).toHaveAttribute("data-gg-ground", "profile", { timeout: 3500 });
  await expect(companionStage).toHaveClass(/is-profile-perched/);
  await expect(companion.locator("canvas.gg-player-sprite")).toHaveAttribute("aria-label", /seated, facing down/);
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
  const comeToTab = menu.getByRole("menuitem", { name: "Come to this tab" });
  const explore = menu.getByRole("menuitem", { name: "Explore the page" });
  await expect(comeToTab).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(explore).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: "Enter Original GG" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(comeToTab).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(companion).toBeFocused();

  await companion.click({ button: "right" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Wave hello" }).click();
  await expect(page.getByText("Hey! Good to see you.")).toBeVisible();

  await companion.click({ button: "right" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Enter Original GG" }).click();
  await expect(page.getByRole("heading", { name: "Football City" })).toBeVisible();
  await page.getByRole("button", { name: /Matchday/ }).click();
  await expect(companion).toBeVisible();
  // Closing the world remounts the companion at its default profile perch.
  const profileAnchor = page.locator(".gg-account-avatar-trigger");
  await expect.poll(async () => {
    const sprite = await companion.boundingBox();
    const anchor = await profileAnchor.boundingBox();
    if (!sprite || !anchor) return Number.POSITIVE_INFINITY;
    return Math.abs(sprite.x + sprite.width / 2 - anchor.x - anchor.width / 2);
  }, { timeout: 5000 }).toBeLessThan(12);
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

test("Matchday swipes do not hijack the five-tab glass navigation drag rail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPublicApi(page);
  await enterGuestMatchday(page);
  const navigation = page.locator(".bottom-nav");
  const buttons = navigation.locator("button[data-tab]");
  await expect(navigation).toBeVisible();
  const startingTab = await navigation.locator("button.active").getAttribute("data-tab");

  // A horizontal touch swipe that begins on the rail must be ignored by the
  // app-level page-swipe recogniser.
  await navigation.evaluate((nav) => {
    const button = nav.querySelector("button[data-tab]");
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const touch = (clientX, clientY) => new Touch({
      identifier: 73, target: button, clientX, clientY, screenX: clientX, screenY: clientY,
    });
    button.dispatchEvent(new TouchEvent("touchstart", {
      bubbles: true, cancelable: true, touches: [touch(x, y)], changedTouches: [touch(x, y)],
    }));
    button.dispatchEvent(new TouchEvent("touchmove", {
      bubbles: true, cancelable: true, touches: [touch(x - 150, y)], changedTouches: [touch(x - 150, y)],
    }));
    button.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true, cancelable: true, touches: [], changedTouches: [touch(x - 150, y)],
    }));
  });
  await expect(navigation.locator("button.active")).toHaveAttribute("data-tab", startingTab);

  // The nav's own pointer-drag controller remains functional and moves the
  // liquid-glass active indicator to the tab beneath the held pointer.
  await navigation.evaluate((nav) => {
    const all = Array.from(nav.querySelectorAll("button[data-tab]"));
    const first = all[0].getBoundingClientRect();
    const last = all[all.length - 1].getBoundingClientRect();
    const x = first.left + first.width / 2;
    const y = first.top + first.height / 2;
    const targetX = last.left + last.width / 2;
    all[0].dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId: 87, pointerType: "touch", isPrimary: true, button: 0, clientX: x, clientY: y,
    }));
    nav.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, cancelable: true, pointerId: 87, pointerType: "touch", isPrimary: true, button: 0, clientX: targetX, clientY: y,
    }));
    nav.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId: 87, pointerType: "touch", isPrimary: true, button: 0, clientX: targetX, clientY: y,
    }));
  });
  await expect(navigation.locator("button.active")).toHaveAttribute("data-tab", await buttons.last().getAttribute("data-tab"));
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
  await expect(page.getByText("Nice one! A new match is in the books.")).toBeVisible();
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
  ).toContain("189, 130, 255");
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
  ).toContain("121, 237, 154");
  const goldPageFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(goldPageFitsViewport).toBeTruthy();
});


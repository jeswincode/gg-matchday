import { test, expect } from "@playwright/test";
import { completeMobileEntry, enterSignedInMatchday } from "./entry-helpers.js";

const actionLabels = { games: "Games", world: "Community World", emote: "Emote", celebration: "Iconic Celebration" };

async function dropCompanion(companion, target, project) {
  const page = companion.page();
  const box = await companion.boundingBox();
  const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  if (project === "chromium-desktop") {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    // Stop at the destination long enough to release without throw momentum.
    await page.waitForTimeout(130);
    await page.mouse.up();
    return;
  }
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [target] });
    await page.waitForTimeout(130);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await session.detach();
  }
}

test("Companion links a participant to their pending Player of the Match vote", async ({ page }) => {
  const response = page.waitForResponse(res => new URL(res.url()).pathname === "/api/matches/pending-votes" && res.ok());
  await page.goto("/?e2eRole=viewer");
  await enterSignedInMatchday(page);
  const [pending] = await (await response).json();
  expect(pending?.name).toBeTruthy();
  const shortCut = page.getByRole("button", { name: "Open vote", exact: true });
  await expect(shortCut).toBeVisible({ timeout: 19_000 });
  await expect(shortCut.locator("..")).toContainText(pending.name);
  await shortCut.click();
  const match = page.getByRole("dialog", { name: pending.name });
  await expect(match.getByRole("heading", { name: "Player of the Match" })).toBeVisible();
});

test("Companion lands on panels and tours Starting XI when idle or dropped onto the pitch", async ({ page }, info) => {
  test.slow();
  await page.route("**/api/matches/pending-votes", route => route.fulfill({ json: [] }));
  await page.route("**/api/clubs/home", route => route.fulfill({ json: {} }));
  const lineup = ["LW", "ST", "RW", "CM", "CM", "CDM", "LB", "CB", "CB", "RB", "GK"].map((position, index) => ({
    _id: "65a0000000000000000000" + String(index + 1).padStart(2, "0"), name: "E2E Pitch Player " + (index + 1),
    position, preferredPositions: [position],
  }));
  await page.route("**/api/players", route => route.fulfill({ json: lineup }));
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  const companion = page.getByRole("button", { name: "GG Companion", exact: true });
  await companion.click();
  const tabs = page.getByRole("navigation", { name: "Matchday tabs" });
  await tabs.getByRole("button", { name: "Calendar" }).click();
  const calendar = page.locator('[data-companion-surface="calendar-panel"]');
  await expect(calendar).toBeVisible();
  await expect.poll(async () => {
    const body = await companion.boundingBox();
    const panel = await calendar.boundingBox();
    return Math.abs(body.y + body.height - panel.y);
  }, { timeout: 19_000 }).toBeLessThan(3);
  const panel = await calendar.boundingBox();
  const beforeDrop = await companion.boundingBox();
  const x = Math.round(panel.x + panel.width * (beforeDrop.x < panel.x + panel.width / 2 ? .74 : .26));
  await dropCompanion(companion, { x, y: Math.round(panel.y - 72) }, info.project.name);
  await expect(companion).toHaveAttribute("data-pose", "stand", { timeout: 3_000 });
  const dropped = await companion.boundingBox();
  expect(Math.abs(dropped.y + dropped.height - panel.y)).toBeLessThan(3);
  expect(Math.abs(dropped.x + dropped.width / 2 - x)).toBeLessThan(12);
  await tabs.getByRole("button", { name: "Players" }).click();
  const pitch = page.locator("[data-companion-pitch]:visible");
  await pitch.scrollIntoViewIfNeeded();
  const speech = page.locator(".gg-companion-speech > span:nth-child(2)");
  await expect(companion).toHaveAttribute("data-pose", "pitch", { timeout: 24_000 });
  await expect(companion.locator(".gg-player-overhead")).toBeVisible();
  await expect(speech).toHaveText(/E2E.*(lines up|recorded|averages|won|leads).*\.$/, { timeout: 12_000 });
  const first = await speech.textContent();
  await expect.poll(async () => {
    const line = await speech.textContent();
    return line !== first && /^E2E.*\.$/.test(line);
  },
    { timeout: 12_000 }).toBeTruthy();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(companion).not.toHaveAttribute("data-pose", "pitch");
  await expect(companion).toHaveAttribute("data-pose", "stand");
  await page.getByRole("button", { name: "Pitch", exact: true }).click();
  await pitch.scrollIntoViewIfNeeded();
  const turf = await pitch.boundingBox();
  const dock = await tabs.boundingBox();
  await dropCompanion(companion, {
    x: Math.round(turf.x + turf.width * .13),
    y: Math.round((Math.max(turf.y, 0) + Math.min(turf.y + turf.height, dock.y)) / 2),
  }, info.project.name);
  await expect(companion).toHaveAttribute("data-pose", "pitch", { timeout: 3_000 });
  await expect(speech).toHaveText(/^E2E.*\.$/, { timeout: 7_000 });
});

async function openActions(character, project, gesture) {
  if (project === "chromium-mobile") {
    const stage = character.locator("..");
    const menu = stage.locator(".gg-companion-touch-menu");
    const point = await character.boundingBox();
    const client = await character.page().context().newCDPSession(character.page());
    const finger = { x: Math.round(point.x + point.width / 2), y: Math.round(point.y + point.height / 2) };
    try {
      const start = Date.now();
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger] });
      // The menu must appear with the finger still down.
      await expect(character).toHaveAttribute("aria-expanded", "true");
      expect(Date.now() - start).toBeGreaterThanOrEqual(750);
      await expect(menu.locator(".gg-companion-touch-icon")).toHaveCount(4);
      await expect(stage.getByRole("group", { name: "Companion actions" })).toHaveCount(0);
      const side = await menu.getAttribute("data-arc-side");
      const arc = await menu.boundingBox();
      expect(arc.width).toBeLessThan(150);
      expect(Math.abs(arc.x + arc.width / 2 - finger.x)).toBeLessThan(2);
      if (gesture) {
        const icon = await menu.locator('g[data-companion-action="' + gesture + '"] circle').boundingBox();
        const target = { x: Math.round(icon.x + icon.width / 2), y: Math.round(icon.y + icon.height / 2) };
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [target] });
        await expect(stage).toHaveAttribute("data-menu-direction", gesture);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(character).toHaveAttribute("aria-expanded", "false");
      await expect(menu).toHaveCount(0);
      await expect(stage.locator(".gg-companion-confirmation")).toHaveCount(0);
      return side;
    } finally {
      await client.detach();
    }
  } else {
    await character.click({ button: "right" });
    const menu = character.page().getByRole("group", { name: "Companion actions" });
    await expect(menu.locator("button svg")).toHaveCount(4);
    await expect(menu.locator(".gg-companion-touch-track")).toHaveCSS("stroke-linecap", "round");
    const anchor = await character.boundingBox();
    const arc = await menu.boundingBox();
    expect(Math.abs(arc.x + arc.width / 2 - anchor.x - anchor.width / 2)).toBeLessThan(2);
    await expect(menu.getByText("Games", { exact: true })).toBeHidden();
    await menu.getByRole("button", { name: "Games" }).hover();
    await expect(menu.getByText("Games", { exact: true })).toBeVisible();
    if (gesture) {
      await character.page().getByRole("button", { name: actionLabels[gesture], exact: true }).click();
    }
  }
}

test("signed-in Companion perches, guides, saves a kit and performs the chosen celebration", async ({ page }, info) => {
  test.slow();
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  const character = page.getByRole("button", { name: "GG Companion", exact: true });
  const avatar = page.getByRole("button", { name: "Account profile settings" });
  const footballer = character.locator(".gg-footballer");
  const speech = page.locator(".gg-companion-speech > span:nth-child(2)");

  await expect(character).toHaveAttribute("data-pose", "sit");
  const darkKit = await footballer.evaluate(node => getComputedStyle(node).getPropertyValue("--player-kit"));
  await page.getByRole("button", { name: "Gold", exact: true }).click();
  await expect.poll(() => footballer.evaluate(node => getComputedStyle(node).getPropertyValue("--player-kit"))).not.toBe(darkKit);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  const seat = await avatar.boundingBox();
  const perched = await character.boundingBox();
  expect(Math.abs(perched.y + perched.height - seat.y)).toBeLessThan(2);
  const stage = character.locator("..");
  await stage.evaluate(node => {
    node.dataset.jumpApex = node.style.getPropertyValue("--companion-y");
    const watch = new MutationObserver(() => {
      node.dataset.jumpApex = String(Math.min(parseFloat(node.dataset.jumpApex),
        parseFloat(node.style.getPropertyValue("--companion-y"))));
    });
    watch.observe(node, { attributeFilter: ["style"] });
    window.setTimeout(() => watch.disconnect(), 2400);
  });
  if (info.project.name === "chromium-desktop") {
    await page.mouse.move(perched.x + perched.width / 2, perched.y + perched.height / 2);
    await page.mouse.down();
    await expect(character).toHaveAttribute("data-pose", "held");
    const held = await character.boundingBox();
    expect(held.x).toBeCloseTo(perched.x, 1);
    expect(held.y).toBeCloseTo(perched.y, 1);
    await page.mouse.up();
  } else {
    await character.click();
  }
  await expect(speech).toHaveText("10 on 10 landing");
  const tabs = page.getByRole("navigation", { name: "Matchday tabs" });
  const dock = await tabs.boundingBox();
  const landing = await character.boundingBox();
  expect(Math.abs(landing.y + landing.height - dock.y)).toBeLessThan(2);
  expect(Number(await stage.getAttribute("data-jump-apex"))).toBeLessThan(seat.y - 12);
  await tabs.getByRole("button", { name: "Calendar" }).click();
  await expect(character).toHaveAttribute("data-travel", "walk");
  await expect(footballer).toHaveCSS("--travel-direction", "1");
  await expect(footballer).toHaveAttribute("data-facing", "right");
  await expect(footballer.locator(".gg-player-leg--right > .gg-player-shin")).toHaveCSS("animation-name", "gg-walk-shin");
  await expect(footballer.locator(".gg-player-leg > .gg-player-short-leg")).toHaveCount(2);
  await expect(speech).toContainText("Choose a date to see its matches.");
  await tabs.getByRole("button", { name: "Leaderboard" }).click();
  await expect(character).toHaveAttribute("data-travel", "walk");
  await expect(footballer).toHaveCSS("--travel-direction", "-1");
  await expect(footballer).toHaveAttribute("data-facing", "left");
  await expect(speech).toContainText("Pick a position or period");

  if (info.project.name === "chromium-desktop") {
    const standing = await character.boundingBox();
    const perch = await avatar.boundingBox();
    await page.mouse.move(standing.x + standing.width / 2, standing.y + standing.height / 2);
    await page.mouse.down();
    await page.mouse.move(perch.x + perch.width / 2, perch.y, { steps: 10 });
    await expect(character).toHaveAttribute("data-grab-side", /left|right/);
    await expect(footballer.locator("[data-grab-path]").first()).toHaveAttribute("d", /^M.+Q/);
    await page.mouse.up();
    await expect(character).toHaveAttribute("data-pose", "sit");
    await expect.poll(async () => {
      const parked = await character.boundingBox();
      return Math.abs(parked.y + parked.height - (await avatar.boundingBox()).y);
    }).toBeLessThan(2);
  }

  await avatar.click();
  await page.getByLabel("Matchday kit").selectOption("away");
  await page.getByLabel("Character").selectOption("captain");
  const angles = page.getByRole("group", { name: "Kit preview angle" });
  await angles.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("img", { name: /Companion kit preview, back view/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Messi/ })).toHaveCount(0);
  await expect(page.getByText(/Messi.*Your El Clásico side/)).toBeVisible();
  await page.getByRole("button", { name: "Save companion" }).click();
  await expect(page.getByText("Companion saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(footballer).toHaveAttribute("data-kit", "away");
  await expect(footballer).toHaveAttribute("data-character", "captain");
  await footballer.evaluate(node => {
    const watch = new MutationObserver(() => {
      if (node.dataset.action === "kiss" &&
        getComputedStyle(node.querySelector(".gg-messi-kiss-hand")).opacity === "1") {
        node.dataset.kissObserved = "true";
      }
      if (node.dataset.action !== "change-back") return;
      node.dataset.returnSwapObserved = "true";
      watch.disconnect();
    });
    watch.observe(node, { attributes: true, attributeFilter: ["data-action"] });
  });
  await openActions(character, info.project.name, "celebration");
  await expect(footballer).toHaveAttribute("data-action", "messi-walk");
  await expect(footballer).toHaveAttribute("data-action", "sky");
  await expect(footballer).toHaveAttribute("data-kiss-observed", "true");
  await expect(footballer).toHaveAttribute("data-temporary-kit", "barcelona");
  await expect(footballer).toHaveAttribute("data-return-swap-observed", "true");
  await expect(footballer).not.toHaveAttribute("data-temporary-kit", "barcelona");

  await page.reload();
  await enterSignedInMatchday(page);
  await expect(footballer).toHaveAttribute("data-kit", "away");
  await expect(footballer).toHaveAttribute("data-character", "captain");
});

test("desktop Clubs Companion hangs from the active navigation tab and climbs to the next", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "Clubs uses a horizontal dock on this mobile viewport.");
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  const tabs = page.getByRole("navigation", { name: "Clubs navigation" });
  const hub = tabs.getByRole("button", { name: "Club Hub", exact: true });
  const matches = tabs.getByRole("button", { name: /^Matches/ });
  const companion = page.getByRole("button", { name: "GG Companion", exact: true });
  await expect(hub).toBeVisible();
  await expect(companion).toHaveAttribute("data-pose", "peek");
  await companion.click();
  await expect(companion).toHaveAttribute("data-pose", "hang");
  await expect(companion.locator(".gg-footballer")).toHaveAttribute("data-facing", "left");
  const initial = await companion.boundingBox();
  const hubBox = await hub.boundingBox();
  expect(initial.x + initial.width / 2).toBeGreaterThan(hubBox.x + hubBox.width);
  await matches.click();
  await expect(companion).toHaveAttribute("data-travel", "climb");
  await expect(companion).not.toHaveAttribute("data-travel", "climb");
  const final = await companion.boundingBox();
  expect(final.y).toBeGreaterThan(initial.y);
  await expect(companion).toHaveAttribute("data-pose", "hang");
  await page.clock.install();
  const right = await page.evaluate(() => innerWidth);
  await page.mouse.move(final.x + final.width / 2, final.y + final.height / 2);
  await page.mouse.down();
  await page.mouse.move(right - 160, 175);
  await page.clock.runFor(25);
  await page.mouse.move(right - 31, 175);
  await page.mouse.up();
  await expect(companion).toHaveAttribute("data-pose", "slide");
  await expect(companion).toHaveAttribute("data-pose", "peek");
  await expect(companion).toHaveAttribute("data-peek", "tab");
  const peek = await companion.boundingBox();
  const anchors = await tabs.locator("button[data-primary-tab]")
    .or(page.locator(".clubs-view-filters > button")).all();
  const bounds = await Promise.all(anchors.map(anchor => anchor.boundingBox()));
  expect(bounds.some(box => box && Math.abs(peek.x + peek.width / 2 - (box.x + box.width / 2)) < 2
    && Math.abs(peek.y + peek.height - box.y - 22) < 3)).toBe(true);
});

test("desktop Companion volleys back onto the dock and does skills after inactivity", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "Desktop dock recovery is distinct from mobile edge rebounds.");
  test.slow();
  await page.clock.install();
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  const companion = page.getByRole("button", { name: "GG Companion", exact: true });
  const tabs = page.getByRole("navigation", { name: "Matchday tabs" });
  await companion.click();
  await expect(companion).toHaveAttribute("data-pose", "stand");
  await tabs.getByRole("button", { name: "Calendar" }).click();
  await expect(companion).toHaveAttribute("data-travel", "walk");
  await expect(companion).not.toHaveAttribute("data-travel", "walk");
  const panel = await page.locator('[data-companion-surface="calendar-panel"]').boundingBox();
  const actor = await companion.boundingBox();
  const dock = await tabs.boundingBox();
  await companion.evaluate(token => {
    const observer = new MutationObserver(records => {
      if (token.dataset.pose === "slide" || records.some(record => record.oldValue === "slide")) {
        token.dataset.sawRailSlide = "true";
        observer.disconnect();
      }
    });
    observer.observe(token, { attributes: true, attributeFilter: ["data-pose"], attributeOldValue: true });
  });
  await page.mouse.move(actor.x + actor.width / 2, actor.y + actor.height / 2);
  await page.mouse.down();
  await page.mouse.move(dock.x / 2, panel.y - 30, { steps: 12 });
  await page.mouse.move(12, panel.y - 30, { steps: 8 });
  await page.mouse.up();
  await expect(companion).toHaveAttribute("data-skill", "volley");
  await expect(companion).toHaveAttribute("data-saw-rail-slide", "true");
  await expect(page.locator(".gg-companion-ball")).toBeVisible();
  await expect(companion).toHaveAttribute("data-pose", "stand");
  await expect.poll(async () => (await companion.boundingBox()).x).toBeGreaterThan(dock.x);
  const recovered = await companion.boundingBox();
  expect(Math.abs(recovered.y + recovered.height - dock.y)).toBeLessThan(3);

  const leaderboard = tabs.getByRole("button", { name: "Leaderboard" });
  await leaderboard.click();
  await expect(companion).toHaveAttribute("data-travel", "walk");
  await expect(companion).not.toHaveAttribute("data-travel", "walk");
  await page.clock.fastForward(34_050);
  await expect(companion).toHaveAttribute("data-skill", "ball-juggle");
  await expect(companion).not.toHaveAttribute("data-skill", "ball-juggle");
  await page.clock.runFor(300);
  await companion.locator("..").evaluate(stage => {
    const watch = new MutationObserver(records => {
      stage.dataset.measuredLayoutWrites = String(Number(stage.dataset.measuredLayoutWrites) + records.length);
    });
    stage.dataset.measuredLayoutWrites = "0";
    watch.observe(stage, { attributeFilter: ["style"] });
    window.setTimeout(() => watch.disconnect(), 1_500);
  });
  await page.mouse.move(120, 210, { steps: 24 });
  await expect(companion.locator("..")).toHaveAttribute("data-measured-layout-writes", "0");
  const stage = companion.locator("..");
  for (const [name, side, direction] of [["Players", "right", 1], ["Home", "left", -1]]) {
    await tabs.getByRole("button", { name }).click();
    await expect(companion).toHaveAttribute("data-travel", "walk");
    await expect(companion).not.toHaveAttribute("data-travel", "walk");
    const pole = await page.locator(".gg-companion-rail--" + side).boundingBox();
    const contact = direction === 1 ? pole.x : pole.x + pole.width;
    await stage.evaluate((node, edge) => {
      node.dataset.closestBallToPole = "Infinity";
      const watch = new MutationObserver(() => {
        if (!node.hasAttribute("data-ball")) return;
        const x = parseFloat(node.style.getPropertyValue("--ball-x"));
        node.dataset.closestBallToPole = String(Math.min(Number(node.dataset.closestBallToPole), Math.abs(edge - x)));
      });
      watch.observe(node, { attributeFilter: ["style"] });
      window.setTimeout(() => watch.disconnect(), 42_000);
    }, contact);
    await page.clock.fastForward(34_050);
    await expect(companion).toHaveAttribute("data-skill", "juggle");
    const position = (name) => stage.evaluate((node, property) => parseFloat(node.style.getPropertyValue(property)), name);
    await expect.poll(() => position("--spark-x")).toBe(contact);
    await expect.poll(async () => Number(await stage.getAttribute("data-closest-ball-to-pole"))).toBeLessThan(28);
    await expect.poll(async () => direction * (contact - await position("--ball-x"))).toBeGreaterThan(65);
    await expect(companion).not.toHaveAttribute("data-skill", "juggle");
  }
});

test("Community World shows the work-in-progress message on the Companion", async ({ page }, info) => {
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  await openActions(page.getByRole("button", { name: "GG Companion", exact: true }), info.project.name, "world");
  await expect(page.locator(".gg-companion-speech > span:nth-child(2)")).toHaveText("Work in Progress");
  await expect(page.getByRole("dialog", { name: "Community World" })).toHaveCount(0);
});

test("Games shows the work-in-progress message on the Companion", async ({ page }, info) => {
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  await openActions(page.getByRole("button", { name: "GG Companion", exact: true }), info.project.name, "games");
  await expect(page.locator(".gg-companion-speech > span:nth-child(2)")).toHaveText("Work in Progress");
  await expect(page.getByRole("dialog", { name: "Games" })).toHaveCount(0);
});

test("Ronaldo swaps into the Madrid kit, runs along the dock and lands the SIUUU", async ({ page }, info) => {
  await page.goto("/?e2eRole=viewer&e2ePlayerId=65a000000000000000000002");
  await enterSignedInMatchday(page);
  const character = page.getByRole("button", { name: "GG Companion", exact: true });
  await expect(character).toBeVisible();
  await character.click();
  await expect(character).toHaveAttribute("data-pose", "stand");
  const before = await character.boundingBox();
  await openActions(character, info.project.name, "celebration");
  const rig = character.locator(".gg-footballer");
  await expect(rig).toHaveAttribute("data-action", "change");
  expect((await character.boundingBox()).x).toBeCloseTo(before.x, 1);
  await expect(rig).toHaveAttribute("data-action", "run");
  await expect(rig).toHaveAttribute("data-temporary-kit", "madrid");
  await expect(rig.locator(".gg-player-leg--right > .gg-player-shin")).toHaveCSS("animation-name", "gg-run-shin");
  await expect(page.locator(".gg-companion-speech > span:nth-child(2)")).toHaveText("SIUUU");
});

test("mobile Companion cancels a bare hold and fans inward at either edge", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "Uses the touch-only menu.");
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  const companion = page.getByRole("button", { name: "GG Companion", exact: true });
  await companion.click();
  await expect(companion).toHaveAttribute("data-pose", "stand");
  expect(await openActions(companion, info.project.name)).toBe("left");
  await expect(companion.locator("..").locator(".gg-companion-speech")).toBeHidden();
  const nav = page.getByRole("navigation", { name: "Matchday tabs" });
  await nav.getByRole("button", { name: "Players" }).click();
  await expect(companion).toHaveAttribute("data-travel", "walk");
  await expect(companion).not.toHaveAttribute("data-travel", "walk");
  expect(await openActions(companion, info.project.name, "world")).toBe("right");
  await expect(page.locator(".gg-companion-speech > span:nth-child(2)")).toHaveText("Work in Progress");
});

test("the Companion falls from a scrolled perch and keeps its position through the Clubs shutters", async ({ page }) => {
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  const companion = page.getByRole("button", { name: "GG Companion", exact: true });
  const stage = companion.locator("..");
  await expect(page.getByRole("heading", { name: "Welcome to GG Matchday", exact: true }).locator("br")).toHaveCount(1);
  await expect(companion).toHaveAttribute("data-pose", "sit");
  await page.evaluate(() => scrollTo({ top: 650, behavior: "instant" }));
  await expect(companion).toHaveAttribute("data-pose", "stand");
  const nav = page.getByRole("navigation", { name: "Matchday tabs" });
  await nav.getByRole("button", { name: "Calendar" }).click();
  await expect(companion).toHaveAttribute("data-travel", "walk");
  await expect(companion).not.toHaveAttribute("data-travel", "walk");
  await expect(companion).not.toHaveAttribute("data-pose", "sit");
  const clubs = page.getByRole("button", { name: "Clubs", exact: true });
  await clubs.scrollIntoViewIfNeeded();
  await stage.evaluate(node => {
    const watch = new MutationObserver(() => {
      if (!node.hasAttribute("data-shutters")) return;
      const token = node.querySelector(".gg-companion-token");
      const scale = Number(token.style.getPropertyValue("--shutter-scale"));
      if (scale > .12) return;
      node.dataset.seamX = node.style.getPropertyValue("--companion-x");
      node.dataset.seamY = node.style.getPropertyValue("--companion-y");
      watch.disconnect();
    });
    watch.observe(node, { attributes: true, subtree: true });
  });
  const before = await stage.evaluate(node => node.style.getPropertyValue("--companion-x"));
  await clubs.click();
  await expect(stage).toHaveAttribute("data-seam-x", before);
  const seam = parseFloat(await stage.getAttribute("data-seam-y"));
  expect(Math.abs(seam - await page.evaluate(() => innerHeight / 2))).toBeLessThan(4);
  await expect(page.locator(".clubs-app")).toBeVisible();
  await expect(companion).toHaveAttribute("data-pose", /^(stand|peek)$/);
  await expect(stage).not.toHaveAttribute("data-shutters", "");
});

test("Clubs Admin has a peek instead of a header perch, and Emote plays a football skill", async ({ page }, info) => {
  await page.goto("/?view=clubs&tab=overview&e2eRole=admin&e2ePlayerId=unlinked");
  await completeMobileEntry(page);
  const companion = page.getByRole("button", { name: "GG Companion", exact: true });
  await expect(page.getByRole("heading", { name: "Clubs Admin", exact: true })).toBeVisible();
  await expect(companion).toHaveAttribute("data-pose", "peek");
  await companion.click();
  await expect(companion).toHaveAttribute("data-pose", /^(hang|stand)$/);
  await openActions(companion, info.project.name, "emote");
  await expect(companion).toHaveAttribute("data-skill", /^(ball-juggle|rainbow|stepovers)$/);
  await expect(page.locator(".gg-companion-ball")).toBeVisible();
});

test("mobile Clubs peeks behind fixture tabs and throws rebound onto the dock", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "Exercises the mobile dock and touch throws.");
  test.slow();
  await page.clock.install();
  await page.goto("/?view=clubs&tab=matches&e2eRole=editor");
  await completeMobileEntry(page);
  const companion = page.getByRole("button", { name: "GG Companion", exact: true });
  const dock = page.getByRole("navigation", { name: "Clubs navigation" });
  const filters = await page.locator('[data-pane="current"] .clubs-view-filters').boundingBox();
  await expect(companion).toHaveAttribute("data-peek", "tab");
  const firstPeek = await companion.boundingBox();
  expect(firstPeek.y + firstPeek.height / 2).toBeGreaterThan(filters.y - 14);
  expect(firstPeek.y + firstPeek.height / 2).toBeLessThan(filters.y + filters.height);
  await companion.click();
  await expect(companion).toHaveAttribute("data-pose", "stand");

  const actor = await companion.boundingBox();
  const right = await page.evaluate(() => innerWidth);
  const client = await page.context().newCDPSession(page);
  const touch = (type, x, y) => client.send("Input.dispatchTouchEvent",
    { type, touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
  try {
    await touch("touchStart", actor.x + actor.width / 2, actor.y + actor.height / 2);
    await touch("touchMove", right - 155, 160);
    await touch("touchMove", right - 8, 160);
    await touch("touchEnd");
    await expect(companion).toHaveAttribute("data-edge", "right-bounce");
    await expect(companion).toHaveAttribute("data-pose", "stand");
    const standing = await companion.boundingBox();
    expect(Math.abs(standing.y + standing.height - (await dock.boundingBox()).y)).toBeLessThan(2);
  } finally {
    await client.detach();
  }
  await page.clock.fastForward(34_100);
  await expect(companion).toHaveAttribute("data-pose", "peek");
  await expect(companion).toHaveAttribute("data-peek", "tab");
  const nextPeek = await companion.boundingBox();
  expect(Math.hypot(nextPeek.x - firstPeek.x, nextPeek.y - firstPeek.y)).toBeGreaterThan(12);
});

test("admins can switch celebrations and choose the Winger", async ({ page }) => {
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await enterSignedInMatchday(page);
  await page.getByRole("button", { name: "Account profile settings" }).click();
  await page.getByLabel("Character").selectOption("winger");
  await page.getByRole("radio", { name: /Messi/ }).check();
  await page.getByRole("button", { name: "Save companion" }).click();
  await expect(page.getByText("Companion saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".gg-companion-token .gg-footballer")).toHaveAttribute("data-character", "winger");
  await page.getByRole("button", { name: "Account profile settings" }).click();
  await expect(page.getByRole("radio", { name: /Messi/ })).toBeChecked();
});

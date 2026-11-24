import { test, expect } from "@playwright/test";
import { enterSignedInMatchday } from "./entry-helpers.js";

async function openActions(character, project, gesture) {
  if (project === "chromium-mobile") {
    const point = await character.boundingBox();
    const client = await character.page().context().newCDPSession(character.page());
    const finger = { x: Math.round(point.x + point.width / 2), y: Math.round(point.y + point.height / 2) };
    try {
      const start = Date.now();
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger] });
      // The menu must appear with the finger still down.
      await expect(character).toHaveAttribute("aria-expanded", "true");
      expect(Date.now() - start).toBeGreaterThanOrEqual(1450);
      if (gesture) {
        const direction = gesture === "world" ? -1 : 1;
        const target = { x: Math.max(1, finger.x + direction * 30), y: Math.max(1, finger.y - 32) };
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [target] });
        await expect(character.locator("..")).toHaveAttribute("data-menu-direction", gesture);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(character).toHaveAttribute("aria-expanded", gesture ? "false" : "true");
    } finally {
      await client.detach();
    }
  } else {
    await character.click({ button: "right" });
    if (gesture) {
      const action = gesture === "world" ? "Community World" : "Emote";
      await character.page().getByRole("button", { name: action, exact: true }).click();
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
    await page.mouse.up();
    await expect(character).toHaveAttribute("data-pose", "sit");
    await expect.poll(async () => {
      const parked = await character.boundingBox();
      return Math.abs(parked.y + parked.height - (await avatar.boundingBox()).y);
    }).toBeLessThan(2);
  }

  await avatar.click();
  await page.getByLabel("Matchday kit").selectOption("away");
  const angles = page.getByRole("group", { name: "Kit preview angle" });
  await angles.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("img", { name: /Companion kit preview, back view/ })).toBeVisible();
  await page.getByRole("radio", { name: /Messi/ }).check();
  await page.getByRole("button", { name: "Save companion" }).click();
  await expect(page.getByText("Companion saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(footballer).toHaveAttribute("data-kit", "away");
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
  await openActions(character, info.project.name, "emote");
  await expect(footballer).toHaveAttribute("data-action", "messi-walk");
  await expect(footballer).toHaveAttribute("data-action", "sky");
  await expect(footballer).toHaveAttribute("data-kiss-observed", "true");
  await expect(footballer).toHaveAttribute("data-temporary-kit", "barcelona");
  await expect(footballer).toHaveAttribute("data-return-swap-observed", "true");
  await expect(footballer).not.toHaveAttribute("data-temporary-kit", "barcelona");

  await page.reload();
  await enterSignedInMatchday(page);
  await expect(footballer).toHaveAttribute("data-kit", "away");
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
  await expect(companion).toHaveAttribute("data-pose", "sit");
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
  const actor = await companion.boundingBox();
  const dock = await tabs.boundingBox();
  await page.mouse.move(actor.x + actor.width / 2, actor.y + actor.height / 2);
  await page.mouse.down();
  await page.mouse.move(dock.x / 2, dock.y - 10, { steps: 12 });
  await page.clock.runFor(150);
  await page.mouse.up();
  await expect(companion).toHaveAttribute("data-skill", "volley");
  await expect(page.locator(".gg-companion-ball")).toBeVisible();
  await expect(companion).toHaveAttribute("data-pose", "stand");
  await expect.poll(async () => (await companion.boundingBox()).x).toBeGreaterThan(dock.x);

  const leaderboard = tabs.getByRole("button", { name: "Leaderboard" });
  await leaderboard.click();
  await expect(companion).toHaveAttribute("data-travel", "walk");
  await expect(companion).not.toHaveAttribute("data-travel", "walk");
  await page.clock.fastForward(34_050);
  await expect(companion).toHaveAttribute("data-skill", "rainbow");
  await expect(companion).not.toHaveAttribute("data-skill", "rainbow");
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

test("Ronaldo swaps into the Madrid kit, runs along the dock and lands the SIUUU", async ({ page }, info) => {
  await page.goto("/?e2eRole=viewer&e2ePlayerId=unlinked");
  await enterSignedInMatchday(page);
  const character = page.getByRole("button", { name: "GG Companion", exact: true });
  await expect(character).toBeVisible();
  await character.click();
  await expect(character).toHaveAttribute("data-pose", "stand");
  const before = await character.boundingBox();
  await openActions(character, info.project.name);
  await page.getByRole("button", { name: "Emote" }).click();
  const rig = character.locator(".gg-footballer");
  await expect(rig).toHaveAttribute("data-action", "change");
  expect((await character.boundingBox()).x).toBeCloseTo(before.x, 1);
  await expect(rig).toHaveAttribute("data-action", "run");
  await expect(rig).toHaveAttribute("data-temporary-kit", "madrid");
  await expect(rig.locator(".gg-player-leg--right > .gg-player-shin")).toHaveCSS("animation-name", "gg-run-shin");
  await expect(page.locator(".gg-companion-speech > span:nth-child(2)")).toHaveText("SIUUU");
});

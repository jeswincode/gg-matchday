import { test, expect } from "@playwright/test";
import { enterSignedInMatchday } from "./entry-helpers.js";

async function openActions(character, project, gesture) {
  if (project === "chromium-mobile") {
    const point = await character.boundingBox();
    const client = await character.page().context().newCDPSession(character.page());
    const finger = { x: Math.round(point.x + point.width / 2), y: Math.round(point.y + point.height / 2) };
    try {
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger] });
      // The menu must appear with the finger still down.
      await expect(character).toHaveAttribute("aria-expanded", "true");
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
      const action = gesture === "world" ? "Enter Community World" : "Emote";
      await character.page().getByRole("button", { name: action, exact: true }).click();
    }
  }
}

test("signed-in Companion perches, guides, saves a kit and performs the chosen celebration", async ({ page }, info) => {
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
  await tabs.getByRole("button", { name: "Calendar" }).click();
  await expect(character).toHaveAttribute("data-travel", "walk");
  await expect(footballer).toHaveCSS("--travel-direction", "1");
  await expect(speech).toContainText("Choose a date to see its matches.");
  await tabs.getByRole("button", { name: "Leaderboard" }).click();
  await expect(character).toHaveAttribute("data-travel", "walk");
  await expect(footballer).toHaveCSS("--travel-direction", "-1");
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
  await page.getByLabel("Celebration", { exact: true }).selectOption("messi");
  await page.getByRole("button", { name: "Save companion" }).click();
  await expect(page.getByText("Companion saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(footballer).toHaveAttribute("data-kit", "away");
  await footballer.evaluate(node => {
    const watch = new MutationObserver(() => {
      if (node.dataset.action !== "change-back") return;
      node.dataset.returnSwapObserved = "true";
      watch.disconnect();
    });
    watch.observe(node, { attributes: true, attributeFilter: ["data-action"] });
  });
  await openActions(character, info.project.name, "emote");
  await expect(footballer).toHaveAttribute("data-action", "sky");
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

test("independent sessions share route movement, emotes, direct waves and departures", async ({ browser, page }, info) => {
  const second = await browser.newPage();
  try {
    await page.goto("/?e2eRole=editor");
    await second.goto("/?e2eRole=viewer&e2ePlayerId=65a000000000000000000002");
    await enterSignedInMatchday(page);
    await enterSignedInMatchday(second);
    await openActions(page.getByRole("button", { name: "GG Companion", exact: true }), info.project.name, "world");
    const observer = second.getByRole("button", { name: "GG Companion", exact: true });
    await observer.click({ button: "right" });
    await second.getByRole("button", { name: "Enter Community World" }).click();

    await expect(page.getByText("2 on the grounds")).toBeVisible();
    const peer = second.locator("button.gg-world-avatar").filter({ hasText: "Playwright editor" });
    await expect(peer).toBeVisible();
    await page.getByRole("button", { name: "Training ground" }).click();
    await expect.poll(async () => peer.evaluate(node => node.style.getPropertyValue("--world-x"))).toBe("82%");
    await page.getByRole("button", { name: "Kick" }).click();
    await expect(peer.locator(".gg-footballer")).toHaveAttribute("data-action", "kick");
    await expect(peer.locator(".gg-footballer")).not.toHaveAttribute("data-action", "kick");
    await page.getByRole("button", { name: "Emote", exact: true }).click();
    await expect(peer.locator(".gg-footballer")).toHaveAttribute("data-action", /^(siuu|sky)$/);
    await peer.click();
    await second.getByRole("button", { name: "Wave to Playwright editor" }).click();
    await expect(page.getByText("Waving to you!")).toBeVisible();
    await second.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByText("1 on the grounds")).toBeVisible();
  } finally {
    await second.close();
  }
});

test("Ronaldo swaps into the Madrid kit, runs along the dock and lands the SIUUU", async ({ page }, info) => {
  await page.goto("/?e2eRole=viewer&e2ePlayerId=unlinked");
  await enterSignedInMatchday(page);
  const character = page.getByRole("button", { name: "GG Companion", exact: true });
  await expect(character).toBeVisible();
  await openActions(character, info.project.name);
  await page.getByRole("button", { name: "Emote" }).click();
  const rig = character.locator(".gg-footballer");
  await expect(rig).toHaveAttribute("data-action", "run");
  await expect(rig).toHaveAttribute("data-temporary-kit", "madrid");
  await expect(page.locator(".gg-companion-speech > span:nth-child(2)")).toHaveText("SIUUU");
});

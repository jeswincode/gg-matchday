import { test, expect } from "@playwright/test";
import { enterSignedInMatchday } from "./entry-helpers.js";

async function openActions(character, project) {
  if (project === "chromium-mobile") {
    const point = await character.boundingBox();
    const client = await character.page().context().newCDPSession(character.page());
    const finger = { x: Math.round(point.x + point.width / 2), y: Math.round(point.y + point.height / 2) };
    try {
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger] });
      await new Promise(resolve => setTimeout(resolve, 600));
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(character).toHaveAttribute("aria-expanded", "true");
    } finally {
      await client.detach();
    }
  } else {
    await character.click({ button: "right" });
  }
}

test("signed-in Companion perches, guides, saves a kit and performs the chosen celebration", async ({ page }, info) => {
  await page.goto("/?e2eRole=editor");
  await enterSignedInMatchday(page);
  const character = page.getByRole("button", { name: "GG Companion", exact: true });
  const avatar = page.getByRole("button", { name: "Account profile settings" });
  const footballer = character.locator(".gg-footballer");

  await expect(character).toHaveAttribute("data-pose", "sit");
  const seat = await avatar.boundingBox();
  const perched = await character.boundingBox();
  expect(Math.abs(perched.y + perched.height - seat.y)).toBeLessThan(2);
  await character.click();
  await expect(page.getByText("10 on 10 landing")).toBeVisible();
  await page.getByRole("navigation", { name: "Matchday tabs" }).getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByText("Choose a date to see its matches.", { exact: false })).toBeVisible();

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
  await openActions(character, info.project.name);
  await page.getByRole("button", { name: "Emote" }).click();
  await expect(footballer).toHaveAttribute("data-action", "sky");
  await expect(footballer).toHaveAttribute("data-temporary-kit", "barcelona");

  await page.reload();
  await enterSignedInMatchday(page);
  await expect(footballer).toHaveAttribute("data-kit", "away");
});

test("independent sessions share route movement, emotes, direct waves and departures", async ({ browser, page }, info) => {
  const second = await browser.newPage();
  try {
    await page.goto("/?e2eRole=editor");
    await second.goto("/?e2eRole=viewer&e2ePlayerId=65a000000000000000000002");
    await enterSignedInMatchday(page);
    await enterSignedInMatchday(second);
    await openActions(page.getByRole("button", { name: "GG Companion", exact: true }), info.project.name);
    await page.getByRole("button", { name: "Enter Community World" }).click();
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
  await expect(page.getByText("SIUUU", { exact: true })).toBeVisible();
});

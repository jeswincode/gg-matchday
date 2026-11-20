import { test, expect } from "@playwright/test";

const PLAYER = "65a000000000000000000041";
const API = "http://127.0.0.1:5000/api";
const authHeaders = (role, id = "unlinked") => ({
  "X-E2E-Test-Token": "gg-matchday-e2e-only-secret",
  "X-E2E-Test-Role": role,
  "X-E2E-Test-Player-Id": id,
});

async function openProfile(page) {
  await page.goto("/?e2eRole=guest");
  await page.getByRole("button", { name: "Explore as Guest" }).click();
  await page.getByRole("button", { name: /Players$/ }).click();
  await page.locator(".player-profile-row").filter({ hasText: "E2E Live Profile" }).click();
  await expect(page.locator(".profile-bio")).toContainText("Original public biography");
}

test("approved player information appears live in two open viewer sessions without a reload", async ({ browser, request }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const first = await context1.newPage();
  const second = await context2.newPage();
  let reloads = 0;
  try {
    for (const page of [first, second]) {
      // Count full navigations, not normal API calls.
      page.on("framenavigated", frame => {
        if (frame === page.mainFrame() && page.url().includes("e2eRole=guest")) reloads++;
      });
    }
    await Promise.all([openProfile(first), openProfile(second)]);
    const navigationsBeforeApproval = reloads;

    const submitted = await request.post(API + "/profile-requests", {
      headers: authHeaders("editor", PLAYER),
      data: { playerId: PLAYER, changes: { bio: "Approved biography published in real time" } },
    });
    expect(submitted.status()).toBe(201);
    const proposal = await submitted.json();

    const approved = await request.post(API + "/profile-requests/admin/" + proposal._id + "/approve", {
      headers: authHeaders("admin"),
      data: {},
    });
    expect(approved.status()).toBe(200);

    await Promise.all([
      expect(first.locator(".profile-bio")).toContainText("Approved biography published in real time", { timeout: 12_000 }),
      expect(second.locator(".profile-bio")).toContainText("Approved biography published in real time", { timeout: 12_000 }),
    ]);
    expect(reloads).toBe(navigationsBeforeApproval);
    await expect(first.locator(".bottom-nav")).toBeVisible();
    await expect(second.locator(".bottom-nav")).toBeVisible();
  } finally {
    await context1.close();
    await context2.close();
  }
});

import { test, expect } from "@playwright/test";
import { completeMobileEntry, enterSignedInMatchday } from "./entry-helpers.js";

const api = "http://127.0.0.1:5000/api";
const playerOne = "65a000000000000000000001";
const playerTwo = "65a000000000000000000002";
const auth = (role, player = "unlinked") => ({
  "X-E2E-Test-Token": "gg-matchday-e2e-only-secret",
  "X-E2E-Test-Role": role,
  "X-E2E-Test-Player-Id": player,
});

async function enter(page, role = "guest", player = "unlinked") {
  await page.goto(`/?e2eRole=${role}&e2ePlayerId=${player}`);
  if (role === "guest") {
    await completeMobileEntry(page);
    await page.getByRole("button", { name: "Explore as Guest" }).click();
  } else {
    await enterSignedInMatchday(page);
  }
  await expect(page.locator(".bottom-nav")).toBeVisible();
}

test("open calendar and leaderboard follow a saved match and recover after reconnecting", async ({ page, browser, request }, testInfo) => {
  const { viewport, isMobile, hasTouch, deviceScaleFactor } = testInfo.project.use;
  const calendar = await browser.newPage({ baseURL: testInfo.project.use.baseURL, viewport, isMobile, hasTouch, deviceScaleFactor });
  try {
    await Promise.all([enter(page), enter(calendar)]);
    await Promise.all([
      page.locator(".bottom-nav").getByRole("button", { name: /Leaderboard/ }).click(),
      calendar.locator(".bottom-nav").getByRole("button", { name: /Calendar/ }).click(),
    ]);
    await expect(calendar.locator(".calendar-day.selected-day")).toBeVisible();
    const row = page.getByRole("table", { name: "Player rankings" }).getByRole("row").filter({ hasText: "E2E Player One" });
    const played = row.getByText(/\d+\/5 matches/);
    await expect(played).toBeVisible();
    const before = Number((await played.textContent()).split("/")[0]);
    let navigations = 0;
    for (const viewer of [page, calendar]) {
      viewer.on("framenavigated", frame => { if (frame === viewer.mainFrame()) navigations++; });
    }
    const date = await page.evaluate(() => {
      const now = new Date();
      return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(value => String(value).padStart(2, "0")).join("-");
    });
    const name = `Live Matchday fixture ${Date.now()}`;
    const data = {
      date, name, teamA: { label: "Live Home", score: 1 }, teamB: { label: "Live Away", score: 0 },
      participants: [
        { player: playerOne, team: "A", performanceCodes: [], ownGoals: 0 },
        { player: playerTwo, team: "B", performanceCodes: [], ownGoals: 0 },
      ],
      events: [{ player: playerOne, type: "goal" }],
    };
    const saved = await request.post(api + "/matches", { headers: auth("editor", playerOne), data });
    expect(saved.status(), await saved.text()).toBe(201);
    const id = (await saved.json()).match._id;
    try {
      await expect(calendar.getByRole("heading", { name, exact: true })).toBeVisible();
      await expect(played).toHaveText(`${before + 1}/5 matches`);
      await calendar.context().setOffline(true);
      const renamed = name + " edited";
      const edit = await request.put(api + "/matches/" + id, { headers: auth("editor", playerOne), data: { ...data, name: renamed } });
      expect(edit.status(), await edit.text()).toBe(200);
      await expect(calendar.getByRole("heading", { name, exact: true })).toBeVisible();
      await calendar.context().setOffline(false);
      await expect(calendar.getByRole("heading", { name: renamed, exact: true })).toBeVisible();
      expect(navigations).toBe(0);
    } finally {
      await request.delete(api + "/matches/" + id, { headers: auth("editor", playerOne) });
    }
  } finally {
    await calendar.close();
  }
});

test("chat and announcements update open community views across accounts", async ({ page, request }) => {
  const unauthorized = await request.get(api + "/live/account");
  expect(unauthorized.status()).toBe(401);
  await enter(page, "viewer", playerTwo);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "Message" });
  await expect(composer).toBeEnabled();
  const message = `Live chat fixture ${Date.now()}`;
  const sent = await request.post(api + "/chat", { headers: auth("editor", playerOne), data: { message } });
  expect(sent.status(), await sent.text()).toBe(201);
  await expect(page.getByText(message, { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Notifications" }).click();
  await expect(page.getByText("Official updates")).toBeVisible();
  const title = `Live announcement fixture ${Date.now()}`;
  const announced = await request.post(api + "/notifications", {
    headers: auth("admin"), data: { title, message: "An isolated preview notification" },
  });
  expect(announced.status(), await announced.text()).toBe(201);
  const { notification } = await announced.json();
  try {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Notifications/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("html")).toHaveAttribute("data-notifications-unread", "true");
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-notifications-unread", "false");
  } finally {
    await request.delete(api + "/notifications/" + notification.id, { headers: auth("admin") });
  }
});

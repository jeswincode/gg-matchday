import { test, expect } from "@playwright/test";
import { enterSignedInMatchday } from "../e2e/entry-helpers.js";

const apiUrl = "http://127.0.0.1:5000/api";
const playerOne = "65a000000000000000000001";
const playerTwo = "65a000000000000000000002";
const identity = (role, player) => ({
  "X-E2E-Test-Token": "gg-matchday-e2e-only-secret",
  "X-E2E-Test-Role": role,
  "X-E2E-Test-Player-Id": player,
});
const editor = identity("editor", playerOne);
const linked = identity("viewer", playerTwo);
const unlinked = identity("viewer", "unlinked");
const admin = identity("admin", "unlinked");

function signIn(page, headers, extra = {}) {
  return page.goto("/?" + new URLSearchParams({
    e2eRole: headers["X-E2E-Test-Role"],
    e2ePlayerId: headers["X-E2E-Test-Player-Id"],
    ...extra,
  }));
}

test("the founding workspace requires a verified membership and keeps its Matchday screens", async ({ page, request }) => {
  await expect.poll(async () => (await request.get(apiUrl + "/matches")).status()).toBe(401);
  await signIn(page, unlinked);
  await expect(page.getByRole("heading", { name: "Your football communities" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open GG Matchday" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request to join GG Matchday" })).toBeVisible();
  expect((await request.get(apiUrl + "/matches", { headers: unlinked })).status()).toBe(403);

  await signIn(page, linked);
  const profileId = page.getByLabel("Global player ID");
  await expect(profileId).toHaveValue(/^[\da-f-]{36}$/);
  const id = await profileId.inputValue();
  await page.reload();
  await expect(profileId).toHaveValue(id);
  await page.getByRole("button", { name: "Open GG Matchday" }).click();
  await enterSignedInMatchday(page);
  await expect(page.getByRole("heading", { name: "Welcome to GG Matchday", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Communities", exact: true }).click();
  await expect(profileId).toHaveValue(id);

  const adminAccount = await (await request.get(apiUrl + "/communities/me", { headers: admin })).json();
  expect(adminAccount.foundingAccess).toBe(true);
  expect(adminAccount.profile._id).not.toBe(id);
});

test("private communities accept one-time codes and approved requests, with isolated match stats", async ({ browser, page, request }) => {
  test.slow();
  const name = "Aster Football";
  await signIn(page, editor);
  await page.getByLabel("Community name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create community", exact: true }).click();
  const tabs = page.getByRole("navigation", { name: "Community tabs" });
  await expect(tabs).toBeVisible();
  await tabs.getByRole("button", { name: "Players", exact: true }).click();
  await page.getByRole("button", { name: "Generate invitation code" }).click();
  const codeField = page.getByLabel("Invitation code", { exact: true });
  await expect(codeField).toHaveValue(/^[a-f0-9]{64}\.[\w-]{43}$/);
  const code = await codeField.inputValue();
  const [communityId, token] = code.split(".");
  const path = apiUrl + "/communities/" + communityId;
  expect((await request.get(path + "/players", { headers: unlinked })).status()).toBe(404);

  const member = await browser.newPage();
  await signIn(member, unlinked);
  await member.getByLabel("Invitation code").fill(code);
  await member.getByRole("button", { name: "Join with code" }).click();
  const memberTabs = member.getByRole("navigation", { name: "Community tabs" });
  await expect(memberTabs).toBeVisible();
  expect((await request.post(path + "/redeem", { headers: linked, data: { token } })).status()).toBe(404);
  expect((await request.get(path + "/join-requests", { headers: unlinked })).status()).toBe(404);

  const requestLink = await page.getByLabel("Request link").inputValue();
  const applicant = await browser.newPage();
  await signIn(applicant, linked, { joinCommunity: new URL(requestLink).searchParams.get("joinCommunity") });
  await applicant.getByRole("button", { name: "Send join request", exact: true }).click();
  await expect(applicant.getByText("Request sent to Aster Football.")).toBeVisible();
  await page.bringToFront();
  await tabs.getByRole("button", { name: "Home", exact: true }).click();
  await tabs.getByRole("button", { name: "Players", exact: true }).click();
  const joinDecision = page.getByRole("combobox", { name: "Decision", exact: true });
  await expect(joinDecision).toBeVisible({ timeout: 26_000 });
  await joinDecision.selectOption("approve");
  await page.getByRole("button", { name: "Save decision" }).click();
  await applicant.bringToFront();
  await expect(applicant.getByRole("button", { name: "Open Aster Football" })).toBeVisible({ timeout: 26_000 });

  const roster = await (await request.get(path + "/players", { headers: editor })).json();
  const owner = roster.items.find(player => player.role === "owner");
  const away = roster.items.find(player => player.role === "member");
  const date = new Date().toISOString().slice(0, 10);
  const recorded = await request.post(path + "/matches", {
    headers: { ...unlinked, "Idempotency-Key": "community-test-match-0001" },
    data: { date, home: "Harbour", away: "Lakeside", homeScore: 1, awayScore: 0,
      performances: [{ playerId: owner.id, side: "home", goals: 1, assists: 0, ownGoals: 0 },
        { playerId: away.id, side: "away", goals: 0, assists: null, ownGoals: 0 }] },
  });
  expect(recorded.status()).toBe(201);
  expect((await recorded.json()).status).toBe("submitted");
  await page.bringToFront();
  await tabs.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("combobox", { name: "Decision", exact: true }).selectOption("approve");
  await page.getByRole("button", { name: "Save match decision" }).click();
  await tabs.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(owner.name) }).filter({ hasText: /1/ })).toHaveCount(1);
  expect((await request.get(path + "/matches", { headers: admin })).status()).toBe(404);
  expect((await request.get(apiUrl + "/matches", { headers: unlinked })).status()).toBe(403);
  await member.close();
  await applicant.close();
});

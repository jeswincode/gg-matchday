import { test, expect } from "@playwright/test";

const apiUrl = "http://127.0.0.1:5000/api";
const playerOne = "65a000000000000000000001";
const playerTwo = "65a000000000000000000002";
const sharedPlayer = "65a000000000000000000003";
const identity = (role, player) => ({
  "X-E2E-Test-Token": "gg-matchday-e2e-only-secret",
  "X-E2E-Test-Role": role,
  "X-E2E-Test-Player-Id": player,
});
const editor = identity("editor", playerOne);
const linked = identity("viewer", playerTwo);
const unlinked = identity("viewer", "unlinked");
const admin = identity("admin", "unlinked");

async function signIn(page, headers, extra = {}) {
  await page.goto("/?" + new URLSearchParams({
    e2eRole: headers["X-E2E-Test-Role"],
    e2ePlayerId: headers["X-E2E-Test-Player-Id"],
    ...extra,
  }));
  await page.getByRole("button", { name: "PRESS TO CONTINUE" }).click();
}

async function setupPlayer(page, expectedName, id) {
  const setup = page.getByRole("dialog", { name: "Set up your player profile" });
  await expect(setup.getByLabel("Player name")).toHaveValue(expectedName);
  await setup.getByLabel("Player ID").fill(id);
  await setup.getByRole("button", { name: "Continue to communities" }).click();
  await expect(setup).toHaveCount(0);
}

test("production-style shared roster links retain Matchday access and separate global identities", async ({ request }) => {
  const owners = [identity("editor", sharedPlayer), identity("viewer", sharedPlayer)];
  const accounts = [];
  for (const headers of owners) {
    const response = await request.get(apiUrl + "/communities/me", { headers });
    expect(response.ok()).toBe(true);
    accounts.push(await response.json());
  }
  for (const account of accounts) {
    expect(account.foundingAccess).toBe(true);
    expect(account.profile.displayName).toBe("E2E Player Three");
  }
  expect(accounts[0].profile._id).not.toBe(accounts[1].profile._id);
  const profile = await request.patch(apiUrl + "/communities/me", { headers: owners[0],
    data: { username: "shared_roster_editor", displayName: "Personal Display Name" } });
  expect(profile.ok()).toBe(true);
  const roster = await (await request.get(apiUrl + "/players", { headers: owners[1] })).json();
  expect(roster.find(player => player._id === sharedPlayer).name).toBe("E2E Player Three");
});


test("the entry and founding workspace preserve correct linked profiles", async ({ page, request }) => {
  await expect.poll(async () => (await request.get(apiUrl + "/matches")).status()).toBe(401);
  await page.goto("/?e2eRole=guest");
  await page.getByRole("button", { name: "PRESS TO CONTINUE" }).click();
  await expect(page.getByRole("dialog", { name: "Your football starts here." })).toBeVisible();
  await expect(page.locator(".ballers-entry-backdrop")).toBeVisible();

  await signIn(page, unlinked);
  await setupPlayer(page, "Playwright viewer", "friendly_viewer");
  await expect(page.getByRole("heading", { name: "Start with your community" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open GG Matchday" })).toHaveCount(0);
  expect((await request.get(apiUrl + "/matches", { headers: unlinked })).status()).toBe(403);

  await signIn(page, linked);
  const before = await (await request.get(apiUrl + "/communities/me", { headers: linked })).json();
  await setupPlayer(page, "E2E Player Two", "player_two");
  await page.getByRole("button", { name: "Open GG Matchday" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to GG Matchday" })).toBeVisible();
  await page.getByRole("button", { name: "Account profile settings" }).click();
  const profile = page.getByRole("dialog", { name: "Account profile settings" });
  const id = before.profile._id;
  expect(id).toMatch(/^[\da-f-]{36}$/);
  await expect(profile.getByLabel("Player name")).toHaveValue("E2E Player Two");
  await profile.getByLabel("Player name").fill("Updated Player Two");
  await profile.getByLabel("Player ID").fill("updated_player_two");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(profile.getByText("Profile saved.")).toBeVisible();

  const player = await (await request.get(apiUrl + "/players", { headers: linked })).json();
  expect(player.find(entry => entry._id === playerTwo).name).toBe("Updated Player Two");
  const account = await (await request.get(apiUrl + "/communities/me", { headers: linked })).json();
  expect(account.profile).toMatchObject({ _id: id, username: "updated_player_two", displayName: "Updated Player Two" });
  const adminAccount = await (await request.get(apiUrl + "/communities/me", { headers: admin })).json();
  expect(adminAccount.foundingAccess).toBe(true);
  expect(adminAccount.profile._id).not.toBe(id);
});

test("private communities use shared football workflows and isolate access and data", async ({ browser, page, request }) => {
  test.slow();
  const name = "Rivals United";
  for (const [headers, username] of [[linked, "reserved_player_id"], [unlinked, "friendly_viewer"]]) {
    expect((await request.patch(apiUrl + "/communities/me", { headers, data: { username } })).status()).toBe(200);
  }
  await signIn(page, editor);
  const setup = page.getByRole("dialog", { name: "Set up your player profile" });
  await setup.getByLabel("Player ID").fill("reserved_player_id");
  await setup.getByRole("button", { name: "Continue to communities" }).click();
  await expect(setup.getByText("That Player ID is already taken. Choose another one.")).toBeVisible();
  await setupPlayer(page, "E2E Player One", "rivals_owner");
  await page.getByLabel("Community name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create community", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Rivals United" })).toBeVisible();
  expect(await page.locator(".home-hero").evaluate(node => getComputedStyle(node, "::after").content)).toContain("RU");
  const tabs = page.getByRole("navigation", { name: "Matchday tabs" });
  await expect(tabs).toBeVisible();
  await expect(page.getByRole("button", { name: "Companion", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Community settings" }).click();
  await page.getByRole("button", { name: "Generate invitation code" }).click();
  const codeField = page.getByLabel("Invitation code", { exact: true });
  await expect(codeField).toHaveValue(/^[a-f0-9]{64}\.[\w-]{43}$/);
  const code = await codeField.inputValue();
  const [communityId, token] = code.split(".");
  const path = apiUrl + "/communities/" + communityId;
  const workspace = apiUrl + "/workspaces/" + communityId;
  expect((await request.get(workspace + "/matches", { headers: unlinked })).status()).toBe(404);
  expect((await request.get(workspace + "/clubs", { headers: admin })).status()).toBe(404);

  const member = await browser.newPage();
  await signIn(member, unlinked);
  await member.getByLabel("Invitation code").fill(code);
  await member.getByRole("button", { name: "Join with code" }).click();
  await expect(member.getByRole("heading", { name: "Welcome to Rivals United" })).toBeVisible();
  expect((await request.post(path + "/redeem", { headers: linked, data: { token } })).status()).toBe(404);
  expect((await request.get(path + "/join-requests", { headers: unlinked })).status()).toBe(404);

  const requestLink = await page.getByLabel("Request link").inputValue();
  const applicant = await browser.newPage();
  await signIn(applicant, linked, { joinCommunity: new URL(requestLink).searchParams.get("joinCommunity") });
  await applicant.getByRole("button", { name: "Send join request", exact: true }).click();
  await expect(applicant.getByText("Request sent to Rivals United.")).toBeVisible();
  await page.bringToFront();
  const decision = page.getByRole("combobox", { name: "Decision", exact: true });
  await expect(decision).toBeVisible({ timeout: 26_000 });
  await decision.selectOption("approve");
  await page.getByRole("button", { name: "Save decision" }).click();
  await applicant.bringToFront();
  await expect(applicant.getByRole("button", { name: "Open Rivals United" })).toBeVisible({ timeout: 26_000 });

  const [ownerAccount, memberAccount] = await Promise.all([editor, unlinked].map(async headers =>
    (await (await request.get(workspace + "/auth/me", { headers })).json()).user));
  expect(ownerAccount.role).toBe("admin");
  expect(memberAccount.role).toBe("viewer");
  expect(ownerAccount.playerProfile).not.toBe(playerOne);
  const date = new Date().toISOString().slice(0, 10);
  const matchData = { date, name: "Rivals friendly", teamA: { label: "Harbour", score: 1 },
    teamB: { label: "Lakeside", score: 0 },
    participants: [{ player: ownerAccount.playerProfile, team: "A", performanceCodes: ["finisher"] }, { player: memberAccount.playerProfile, team: "B", performanceCodes: [] }],
    events: [{ player: ownerAccount.playerProfile, type: "goal" }] };
  expect((await request.post(workspace + "/matches", { headers: unlinked, data: matchData })).status()).toBe(403);
  const match = await request.post(workspace + "/matches", { headers: editor, data: matchData });
  expect(match.status(), await match.text()).toBe(201);
  const matches = await (await request.get(workspace + "/matches", { headers: linked })).json();
  expect(matches).toHaveLength(1);
  expect(matches[0].participants[0].player.name).toBe(ownerAccount.name);

  const vote = await request.post(workspace + "/matches/" + matches[0]._id + "/votes", { headers: unlinked,
    data: { playerId: ownerAccount.playerProfile } });
  expect(vote.status(), await vote.text()).toBe(201);
  expect((await request.post(workspace + "/matches/" + matches[0]._id + "/finalize-vote", { headers: editor })).status()).toBe(200);
  expect((await request.get(workspace + "/stats/hall-of-fame", { headers: linked })).status()).toBe(200);
  expect((await request.post(workspace + "/chat", { headers: unlinked, data: { message: "Private Rivals discussion" } })).status()).toBe(201);
  const ownChat = await (await request.get(workspace + "/chat", { headers: editor })).json();
  const foundingChat = await (await request.get(apiUrl + "/chat", { headers: editor })).json();
  expect(ownChat.messages.some(message => message.text === "Private Rivals discussion")).toBe(true);
  expect(foundingChat.messages.some(message => message.text === "Private Rivals discussion")).toBe(false);
  const foundingMatches = await (await request.get(apiUrl + "/matches", { headers: editor })).json();
  expect(foundingMatches.some(entry => entry.name === "Rivals friendly")).toBe(false);
  expect((await request.get(workspace + "/SYSTEM/database-health", { headers: editor })).status()).toBe(404);

  await page.bringToFront();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await tabs.getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Club Hub" })).toBeVisible();
  await expect(page.getByText("RIVALS UNITED", { exact: true })).toBeVisible();
  expect(await (await request.get(workspace + "/clubs", { headers: linked })).json()).toEqual([]);
  await member.close();
  await applicant.close();
});

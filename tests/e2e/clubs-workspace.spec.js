import { test, expect } from "@playwright/test";

const api = "http://127.0.0.1:5000/api";
const captainId = "65a000000000000000000001";
const memberId = "65a000000000000000000002";
const opponentCaptainId = "65a000000000000000000021";
const roleFor = playerId => playerId === memberId ? "viewer" : "editor";
const auth = playerId => ({
  "X-E2E-Test-Token": "gg-matchday-e2e-only-secret",
  "X-E2E-Test-Role": roleFor(playerId),
  "X-E2E-Test-Player-Id": playerId,
});

async function openClubs(page, playerId) {
  await page.goto("/?e2eRole=" + roleFor(playerId) + "&e2ePlayerId=" + playerId);
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Clubs navigation" })).toBeVisible();
}

function fixtureDay() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + 3 * 86_400_000)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

test("Clubs opens the signed-in player's full profile and keeps editing optional", async ({ page }) => {
  await page.route(new RegExp(`/api/players(?:/${memberId})?$`), async route => {
    const response = await route.fetch();
    const addVideo = player => player._id === memberId ? { ...player, backgroundVideoUrl: "/ggmatchdaybg.mp4" } : player;
    const data = await response.json();
    await route.fulfill({ response, json: Array.isArray(data) ? data.map(addVideo) : addVideo(data) });
  });
  await openClubs(page, memberId);
  const header = page.locator(".clubs-compact-header");
  await expect(header.getByRole("button", { name: "Profile Admin" })).toHaveCount(0);
  await header.getByRole("button", { name: "Player Profile", exact: true }).click();
  const profileHeading = page.locator(".player-profile").getByRole("heading", { name: "E2E Player Two", level: 2, exact: true });
  await expect(profileHeading).toBeInViewport();
  await expect(profileHeading).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const sections = page.getByRole("tablist", { name: "Player profile sections" });
  const banner = page.locator(".profile-hero");
  const styles = banner.locator(".player-styles");
  await expect(styles).toBeVisible();
  const bannerHeight = await banner.evaluate(element => element.offsetHeight);
  const video = await banner.locator("video").elementHandle();
  const overview = sections.getByRole("tab", { name: "Overview" });
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Player details" })).toBeVisible();
  await overview.press("ArrowRight");
  const stats = sections.getByRole("tab", { name: "Stats" });
  await expect(stats).toBeFocused();
  await expect(page.getByRole("heading", { name: "Career statistics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Player details" })).toHaveCount(0);
  await sections.getByRole("tab", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Recent matches" })).toBeVisible();
  await sections.getByRole("tab", { name: "Honors" }).click();
  await expect(page.getByRole("heading", { name: "Awards", exact: true })).toBeVisible();
  await expect(styles).toBeVisible();
  await expect.poll(() => banner.evaluate(element => element.offsetHeight)).toBe(bannerHeight);
  expect(await banner.locator("video").evaluate((element, original) => element === original, video)).toBe(true);
  await page.getByRole("button", { name: "Request profile edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Request profile edit" });
  await expect(editor.getByRole("button", { name: "Submit for Approval" })).toBeVisible();
  await expect(editor.getByText("Link account to player")).toHaveCount(0);
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Request profile edit", exact: true })).toBeFocused();
});

test("the account avatar and player photo open the appropriate profile settings", async ({ page }) => {
  await page.goto(`/?e2eRole=editor&e2ePlayerId=${captainId}`);
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  const navigation = page.getByRole("navigation", { name: "Matchday tabs" });
  await navigation.getByRole("button", { name: /Calendar/ }).click();
  const avatar = page.getByRole("button", { name: "Account profile settings" });
  await avatar.click();
  const account = page.getByRole("dialog", { name: "Account profile settings" });
  await expect(account.getByRole("heading", { name: "Linked player profile" })).toBeVisible();
  await account.getByRole("button", { name: "Gold", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "golden");
  await account.getByRole("button", { name: "Edit player profile" }).click();

  const editor = page.getByRole("dialog", { name: "Edit player profile" });
  await expect(editor.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await expect(editor.getByRole("button", { name: "Save Profile" })).toBeVisible();
  await editor.getByRole("button", { name: "Close dialog" }).click();
  const banner = page.locator(".profile-hero");
  await expect(banner.getByText("Edit Profile", { exact: true })).toHaveCount(0);
  const photo = banner.getByRole("button", { name: "Edit player profile" });
  await photo.click();
  const bio = editor.getByRole("textbox", { name: "Bio" });
  await bio.pressSequentially("Profile edited in the test dialog.");
  await expect(bio).toBeFocused();
  await editor.getByRole("button", { name: "Save Profile" }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(".profile-bio")).toContainText("Profile edited in the test dialog.");
  await expect(photo).toBeFocused();
});

test("captain fixture requests are private and a squad member can track an own-Club bet and refund", async ({ page, browser, request }, testInfo) => {
  test.setTimeout(60_000);
  const { viewport, deviceScaleFactor, isMobile, hasTouch, baseURL } = testInfo.project.use;
  const captain = await browser.newPage({ viewport, deviceScaleFactor, isMobile, hasTouch, baseURL });
  let matchId;
  try {
    await Promise.all([openClubs(page, memberId), openClubs(captain, captainId)]);
    await Promise.all([page, captain].map(actor => actor.locator('[data-primary-tab="matches"]').click()));
    const slate = page.locator("#clubs-match-center");
    await expect(slate.getByRole("heading", { name: "Schedule & fixtures" })).toBeVisible();
    await expect(slate.getByRole("button", { name: "Request fixture" })).toHaveCount(0);
    await expect(captain.getByRole("button", { name: "Request fixture", exact: true })).toBeVisible();

    const marketButton = page.locator('[data-primary-tab="market"]');
    if (!(await marketButton.isVisible())) await page.getByRole("button", { name: "More", exact: true }).click();
    await marketButton.click();
    await expect(page.getByRole("heading", { name: "Offers made to you" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Send a signing offer" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Players who chose your club" })).toHaveCount(0);
    await page.locator('[data-primary-tab="matches"]').click();

    const approved = await (await request.get(api + "/clubs")).json();
    const own = approved.find(club => club.name === "E2E My Club Regression FC");
    const opponent = approved.find(club => club.name === "E2E Auction Workflow FC");
    const fixtureDate = fixtureDay();
    const submitted = await request.post(api + "/clubs/matches", {
      headers: auth(opponentCaptainId), data: { clubAId: opponent._id, clubBId: own._id, fixtureDate },
    });
    expect(submitted.status(), await submitted.text()).toBe(201);
    matchId = (await submitted.json())._id;
    const publicPending = await (await request.get(api + "/clubs/matches")).json();
    expect(publicPending.some(match => match._id === matchId)).toBe(false);
    const memberPending = await (await request.get(api + "/clubs/matches/requests/me", { headers: auth(memberId) })).json();
    expect(memberPending).toEqual([]);
    const forbidden = await request.post(api + "/clubs/matches/" + matchId + "/respond", {
      headers: auth(memberId), data: { accept: true },
    });
    expect(forbidden.status()).toBe(403);
    await expect(slate.getByRole("region", { name: "Captain fixture requests" })).toHaveCount(0);
    await captain.getByRole("region", { name: "Captain fixture requests" }).getByRole("button", { name: "Accept" }).click();
    await expect(slate.getByText(opponent.name, { exact: true })).toBeVisible();
    await expect(slate.getByRole("button", { name: "Cancel fixture" })).toHaveCount(0);
    await expect(slate.getByRole("button", { name: "Place bet" })).toHaveCount(0);

    await page.locator('[data-primary-tab="betting"]').click();
    const betting = page.locator(".clubs-betting-view");
    const card = betting.locator(".clubs-fixture-card").filter({ hasText: opponent.name });
    await card.getByLabel("Back a club").selectOption(own._id);
    await card.getByLabel("Stake (credits)").fill("20");
    await card.getByRole("button", { name: "Place bet", exact: true }).click();
    await expect(betting.getByRole("status").filter({ hasText: "Bet placed" })).toBeVisible();
    await expect(betting.getByRole("button", { name: "Open bets" })).toHaveAttribute("aria-pressed", "true");
    await expect(betting.getByText("20 cr", { exact: true })).toBeVisible();

    await page.locator('[data-primary-tab="playerDesk"]').click();
    await expect(page.locator(".clubs-wallet-main-value")).toHaveText("60");
    await page.getByRole("button", { name: "Rewards", exact: true }).click();
    await expect(page.getByText("Player match reward")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Club rewards" })).toBeVisible();
    const unrelated = await (await request.get(api + "/clubs/bets/me", { headers: auth(captainId) })).json();
    expect(unrelated.bets).toEqual([]);

    await page.locator('[data-primary-tab="betting"]').click();
    await betting.getByRole("button", { name: "Settled", exact: true }).click();
    const cancelled = await request.post(api + "/clubs/matches/" + matchId + "/cancel", { headers: auth(opponentCaptainId) });
    expect(cancelled.status(), await cancelled.text()).toBe(200);
    matchId = undefined;
    await expect(betting.getByText("Refunded", { exact: true })).toBeVisible();
    await page.locator('[data-primary-tab="playerDesk"]').click();
    await page.getByRole("button", { name: "Wallet", exact: true }).click();
    await expect(page.locator(".clubs-wallet-main-value")).toHaveText("80");
  } finally {
    if (matchId) await request.post(api + "/clubs/matches/" + matchId + "/cancel", { headers: auth(opponentCaptainId) });
    await captain.close();
  }
});

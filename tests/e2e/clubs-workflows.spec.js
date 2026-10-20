import { test, expect } from "@playwright/test";

const FORMATION_PLAYERS = [
  { id: "65a000000000000000000011", name: "E2E Formation Founder" },
  { id: "65a000000000000000000012", name: "E2E Formation Invitee Two" },
  { id: "65a000000000000000000013", name: "E2E Formation Invitee Three" },
  { id: "65a000000000000000000014", name: "E2E Formation Invitee Four" },
];

const FORMATION_CLUB_NAME = "E2E Browser Formation FC";
const FORMATION_DETAILS = "An isolated browser test Club with an agreed identity.";

const AUCTION_CLUB_NAME = "E2E Auction Workflow FC";
const AUCTION_AMOUNT = "200";
const AUCTION_PLAYERS = {
  captainOne: { id: "65a000000000000000000021", name: "E2E Auction Captain One" },
  captainTwo: { id: "65a000000000000000000022", name: "E2E Auction Captain Two" },
  target: { id: "65a000000000000000000025", name: "E2E Auction Signing Target" },
};

function actorUrl({ role = "editor", playerId = null }) {
  const params = new URLSearchParams({ e2eRole: role });
  if (playerId) params.set("e2ePlayerId", playerId);
  return "/?" + params.toString();
}

async function loadClubs(page, actor) {
  await page.goto(actorUrl(actor));
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.locator(".clubs-app")).toBeVisible();
  await expect(page.getByRole("navigation", {
    name: actor.role === "admin" && !actor.playerId ? "Clubs admin navigation" : "Clubs navigation",
  })).toBeVisible();
}

async function newClubsActor(browser, actor) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await loadClubs(page, actor);
  return page;
}

function captureClubApi(page) {
  const responses = [];
  page.on("response", async response => {
    if (!new URL(response.url()).pathname.startsWith("/api/clubs/") &&
        !new URL(response.url()).pathname.startsWith("/api/players")) return;
    let body = "";
    try { body = (await response.text()).slice(0, 700); } catch { /* Response body may already be unavailable. */ }
    responses.push({ status: response.status(), path: new URL(response.url()).pathname, body });
  });
  return responses;
}

async function expectAnnouncementOrExplainFailure(page, expected, responses) {
  await expect.poll(async () => {
    const announcement = (await page.locator(".clubs-screen-reader-status").innerText().catch(() => "")).trim();
    if (announcement === expected) return announcement;
    const error = (await page.locator(".clubs-error").innerText().catch(() => "")).trim();
    return error ? `ERROR: ${error} | API: ${JSON.stringify(responses.slice(-8))}` : announcement;
  }, { timeout: 10_000 }).toBe(expected);
}

async function goToPrimaryTab(page, name) {
  const navigation = page.getByRole("navigation", { name: "Clubs navigation" });
  await navigation.getByRole("button", { name, exact: true }).click();
}

test("Club formation works across member, captain, and admin browser sessions", async ({ browser }) => {
  test.setTimeout(120_000);
  const pages = [];
  const actors = FORMATION_PLAYERS.map(player => ({ ...player, role: "editor" }));
  let adminBeforeDetails;

  try {
    const founder = await newClubsActor(browser, actors[0]);
    pages.push(founder);
    const formationResponses = captureClubApi(founder);

    await founder.getByRole("button", { name: /Form a Club/ }).first().click();
    const inviteSelects = founder.locator("#clubs-formation-form .clubs-invite-grid select");
    await expect(inviteSelects).toHaveCount(4);
    for (let index = 1; index < actors.length; index += 1) {
      await inviteSelects.nth(index - 1).selectOption(actors[index].id);
    }
    await founder.getByRole("button", { name: "Start Club Formation" }).click();
    await expectAnnouncementOrExplainFailure(founder, "Club formation invitation sent to the selected players.", formationResponses);

    // Each invitee joins with a separate test identity and accepts through the UI.
    const invitees = [];
    for (const actor of actors.slice(1)) {
      const page = await newClubsActor(browser, actor);
      invitees.push(page);
      pages.push(page);
      const accept = page.getByRole("button", { name: "Accept", exact: true });
      await expect(accept).toBeVisible();
      await accept.click();
      await expect(page.getByText("Club formation invitation accepted.")).toBeVisible();
    }

    // The founder reloads to observe the acceptance committed by the other sessions.
    await loadClubs(founder, actors[0]);
    await expect(founder.getByPlaceholder("Propose the permanent club name")).toBeVisible();
    await founder.getByPlaceholder("Propose the permanent club name").fill(FORMATION_CLUB_NAME);
    await founder.getByRole("button", { name: "Propose Name", exact: true }).click();
    await founder.getByRole("button", { name: "Start Captain Vote", exact: true }).click();
    await expect(founder.locator(".clubs-vote-candidate")).toHaveCount(2);

    const candidateNames = await founder.locator(".clubs-vote-candidate strong").allTextContents();
    const electedCandidateName = candidateNames[0].trim();
    const electedCandidate = actors.find(actor => actor.name === electedCandidateName);
    expect(electedCandidate, "the UI-selected captain candidate should belong to this formation").toBeTruthy();

    // Reload each invitee so their browser sees the captain election started by the founder.
    for (let index = 0; index < invitees.length; index += 1) {
      const page = invitees[index];
      const actor = actors[index + 1];
      await loadClubs(page, actor);
      const candidateButton = page.locator(".clubs-vote-candidate").filter({ hasText: electedCandidateName });
      await expect(candidateButton).toBeVisible();
      await candidateButton.click();
      await expect(page.getByText("Captain vote recorded.")).toBeVisible();
    }

    // The founder votes last, which completes the all-members election.
    const founderCandidateButton = founder.locator(".clubs-vote-candidate").filter({ hasText: electedCandidateName });
    await expect(founderCandidateButton).toBeVisible();
    await founderCandidateButton.click();
    const votedFormation = founder.locator(".clubs-application").filter({ hasText: FORMATION_CLUB_NAME });
    await expect(votedFormation).toContainText("Waiting for captain details approval");

    // An administrator must not see a formation before its elected captain approves the details.
    adminBeforeDetails = await newClubsActor(browser, { role: "admin" });
    pages.push(adminBeforeDetails);
    await adminBeforeDetails.getByRole("button", { name: /^Applications/ }).click();
    await expect(adminBeforeDetails.getByText("No Club formations are waiting for admin action.")).toBeVisible();
    await adminBeforeDetails.close();

    // The elected captain approves the details using their own session.
    const captainPage = electedCandidate.id === actors[0].id
      ? founder
      : invitees[actors.findIndex(actor => actor.id === electedCandidate.id) - 1];
    await loadClubs(captainPage, electedCandidate);
    await captainPage.getByLabel("Club details / identity").fill(FORMATION_DETAILS);
    await captainPage.getByRole("button", { name: "Approve Details", exact: true }).click();
    await expect(captainPage.getByText("All elected captain(s) approved the details. Waiting for administrator approval.")).toBeVisible();

    const admin = await newClubsActor(browser, { role: "admin" });
    pages.push(admin);
    await admin.getByRole("button", { name: /^Applications/ }).click();
    const application = admin.locator(".clubs-application").filter({ hasText: FORMATION_CLUB_NAME });
    await expect(application).toBeVisible();
    await application.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(admin.getByText("Club formation approved.")).toBeVisible();

    // Verify the approved Club from a member's refreshed browser view.
    await loadClubs(founder, actors[0]);
    await goToPrimaryTab(founder, "My Club");
    await expect(founder.getByRole("heading", { name: FORMATION_CLUB_NAME, exact: true })).toBeVisible();
    await expect(founder.locator(".clubs-myclub-overview-stat").first()).toContainText("4/5");
    await expect(founder.getByRole("heading", { name: "Club timeline" })).toBeVisible();
  } finally {
    await Promise.allSettled(pages.map(page => page.close()));
  }
});

test("auction signing reserves budget and settles only after player choice and both captain approvals", async ({ browser }) => {
  test.setTimeout(120_000);
  const pages = [];
  const captainOne = await newClubsActor(browser, AUCTION_PLAYERS.captainOne);
  pages.push(captainOne);
  const auctionResponses = captureClubApi(captainOne);

  try {
    await goToPrimaryTab(captainOne, "Market");
    await expect(captainOne.getByRole("heading", { name: "Send a signing offer" })).toBeVisible();
    const offerSelects = captainOne.locator("#clubs-auction-desk .clubs-invite-grid select");
    await expect.poll(
      () => offerSelects.nth(0).locator("option").allTextContents(),
      { timeout: 10_000 },
    ).toContain(AUCTION_CLUB_NAME);
    await offerSelects.nth(0).selectOption({ label: AUCTION_CLUB_NAME });
    await offerSelects.nth(1).selectOption(AUCTION_PLAYERS.target.id);
    await captainOne.locator("#clubs-auction-desk input[type='number']").fill(AUCTION_AMOUNT);
    await captainOne.getByRole("button", { name: "Send Signing Offer", exact: true }).click();
    await expectAnnouncementOrExplainFailure(captainOne, "Signing offer sent.", auctionResponses);

    // The submitted offer reserves the Club budget without debiting it yet.
    await goToPrimaryTab(captainOne, "My Club");
    await expect(captainOne.getByRole("heading", { name: AUCTION_CLUB_NAME, exact: true })).toBeVisible();
    const reservedRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Reserved for offers" });
    const totalRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Total club funds" });
    await expect(reservedRow).toContainText("200");
    await expect(totalRow).toContainText("3,000");
    await expect(captainOne.locator(".clubs-myclub-overview-stat").first()).toContainText("4/5");

    const target = await newClubsActor(browser, { role: "editor", playerId: AUCTION_PLAYERS.target.id });
    pages.push(target);
    await goToPrimaryTab(target, "Market");
    await expect(target.getByRole("heading", { name: "Offers made to you" })).toBeVisible();
    const chooseOffer = target.getByRole("button", { name: "Choose this club", exact: true });
    await expect(chooseOffer).toBeVisible();
    await chooseOffer.click();
    await expect(target.getByText("Auction offer selected.")).toBeVisible();

    // A chosen offer is not a completed signing: the target still has no Club and no payment.
    await goToPrimaryTab(target, "My Club");
    await expect(target.locator(".clubs-myclub-empty")).toContainText("You are not currently under a Club contract.");
    await expect(target.locator(".clubs-wallet-main-value")).toHaveText("0");

    await goToPrimaryTab(captainOne, "Market");
    const incomingOffer = captainOne.locator(".clubs-application").filter({ hasText: AUCTION_PLAYERS.target.name });
    await expect(incomingOffer.getByRole("button", { name: "Approve signing", exact: true })).toBeVisible();
    await incomingOffer.getByRole("button", { name: "Approve signing", exact: true }).click();
    await expect(incomingOffer.getByText("Your approval recorded", { exact: true })).toBeVisible();

    // One approval cannot finalize the transaction or consume the reserved balance.
    await goToPrimaryTab(captainOne, "My Club");
    await expect(captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Reserved for offers" })).toContainText("200");
    await expect(captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Total club funds" })).toContainText("3,000");
    await expect(captainOne.locator(".clubs-myclub-overview-stat").first()).toContainText("4/5");
    await expect(target.locator(".clubs-wallet-main-value")).toHaveText("0");

    const captainTwo = await newClubsActor(browser, AUCTION_PLAYERS.captainTwo);
    pages.push(captainTwo);
    await goToPrimaryTab(captainTwo, "Market");
    const secondCaptainOffer = captainTwo.locator(".clubs-application").filter({ hasText: AUCTION_PLAYERS.target.name });
    await expect(secondCaptainOffer.getByRole("button", { name: "Approve signing", exact: true })).toBeVisible();
    await secondCaptainOffer.getByRole("button", { name: "Approve signing", exact: true }).click();
    await expect(captainTwo.getByText("Signing approval recorded.")).toBeVisible();

    // The second captain completes the signing: wallet commitment settles exactly once.
    await loadClubs(captainOne, AUCTION_PLAYERS.captainOne);
    await goToPrimaryTab(captainOne, "My Club");
    await expect(captainOne.getByRole("heading", { name: AUCTION_CLUB_NAME, exact: true })).toBeVisible();
    const finalReservedRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Reserved for offers" });
    const finalTotalRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Total club funds" });
    await expect(finalReservedRow).toContainText("0");
    await expect(finalTotalRow).toContainText("2,800");
    await expect(captainOne.locator(".clubs-myclub-overview-stat").first()).toContainText("5/5");
    await expect(captainOne.locator(".clubs-roster-premium-row").filter({ hasText: AUCTION_PLAYERS.target.name })).toBeVisible();

    await loadClubs(target, { role: "editor", playerId: AUCTION_PLAYERS.target.id });
    await goToPrimaryTab(target, "My Club");
    await expect(target.getByRole("heading", { name: AUCTION_CLUB_NAME, exact: true })).toBeVisible();
    await expect(target.locator(".clubs-wallet-main-value")).toHaveText("200");
    await expect(target.locator(".clubs-roster-premium-row").filter({ hasText: AUCTION_PLAYERS.target.name })).toBeVisible();
  } finally {
    await Promise.allSettled(pages.map(page => page.close()));
  }
});

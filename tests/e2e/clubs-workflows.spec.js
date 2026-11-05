import { test, expect } from "@playwright/test";

const FORMATION_PLAYERS = [
  { id: "65a000000000000000000011", name: "E2E Formation Founder" },
  { id: "65a000000000000000000012", name: "E2E Formation Invitee Two" },
  { id: "65a000000000000000000013", name: "E2E Formation Invitee Three" },
  { id: "65a000000000000000000014", name: "E2E Formation Invitee Four" },
];
const FORMATION_RETRY_PLAYERS = [
  { id: "65a000000000000000000015", name: "E2E Formation Retry Founder" },
  { id: "65a000000000000000000016", name: "E2E Formation Retry Invitee Two" },
  { id: "65a000000000000000000017", name: "E2E Formation Retry Invitee Three" },
  { id: "65a000000000000000000018", name: "E2E Formation Retry Invitee Four" },
];
const FORMATION_FIXTURES = [
  { clubName: "E2E Browser Formation FC", players: FORMATION_PLAYERS },
  { clubName: "E2E Browser Formation Retry FC", players: FORMATION_RETRY_PLAYERS },
];
const FORMATION_DETAILS = "An isolated browser test Club with an agreed identity.";

const AUCTION_AMOUNT = "200";
const AUCTION_FIXTURES = [
  {
    clubName: "E2E Auction Workflow FC",
    players: {
      captainOne: { id: "65a000000000000000000021", name: "E2E Auction Captain One" },
      captainTwo: { id: "65a000000000000000000022", name: "E2E Auction Captain Two" },
      target: { id: "65a000000000000000000025", name: "E2E Auction Signing Target" },
    },
  },
  {
    clubName: "E2E Auction Retry Workflow FC",
    players: {
      captainOne: { id: "65a000000000000000000026", name: "E2E Auction Retry Captain One" },
      captainTwo: { id: "65a000000000000000000027", name: "E2E Auction Retry Captain Two" },
      target: { id: "65a000000000000000000030", name: "E2E Auction Retry Signing Target" },
    },
  },
];

function actorUrl({ role = "editor", playerId = null, id = null }) {
  const params = new URLSearchParams({ e2eRole: role });
  const resolvedPlayerId = playerId || id;
  if (resolvedPlayerId) params.set("e2ePlayerId", resolvedPlayerId);
  else if (role === "admin") params.set("e2ePlayerId", "unlinked");
  return "/?" + params.toString();
}

async function loadClubs(page, actor) {
  await page.goto(actorUrl(actor));
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.locator(".clubs-app")).toBeVisible();
  const linkedPlayerId = actor.playerId || actor.id;
  await expect(page.getByRole("navigation", {
    name: actor.role === "admin" && !linkedPlayerId ? "Clubs admin navigation" : "Clubs navigation",
  })).toBeVisible();
}

async function newClubsActor(browser, actor) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await loadClubs(page, actor);
  return page;
}

async function clickAndExpectApi(page, locator, path, expectedStatus = 200) {
  const responsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === path &&
    response.request().method() === "POST",
  );
  await locator.click();
  const response = await responsePromise;
  const data = await response.json().catch(() => ({}));
  expect(response.status(), `POST ${path} response: ${JSON.stringify(data)}`).toBe(expectedStatus);
  return data;
}

async function goToPrimaryTab(page, name) {
  const navigation = page.getByRole("navigation", { name: "Clubs navigation" });
  await navigation.getByRole("button", { name, exact: true }).click();
}

test("Club formation works across member, captain, and admin browser sessions", async ({ browser }) => {
  test.setTimeout(120_000);
  const pages = [];
  const fixture = FORMATION_FIXTURES[Math.min(test.info().retry, FORMATION_FIXTURES.length - 1)];
  const formationClubName = fixture.clubName;
  const actors = fixture.players.map(player => ({ ...player, role: "editor" }));
  let adminBeforeDetails;

  try {
    const founder = await newClubsActor(browser, actors[0]);
    pages.push(founder);

    await founder.getByRole("button", { name: /Form a Club/ }).first().click();
    const inviteSelects = founder.locator("#clubs-formation-form .clubs-invite-grid select");
    await expect(inviteSelects).toHaveCount(4);
    for (let index = 1; index < actors.length; index += 1) {
      await inviteSelects.nth(index - 1).selectOption(actors[index].id);
    }
    const createdFormation = await clickAndExpectApi(
      founder,
      founder.getByRole("button", { name: "Start Club Formation" }),
      "/api/clubs/formation",
      201,
    );
    const formationId = String(createdFormation._id);
    const founderApplication = founder.locator(".clubs-application").filter({ hasText: "Unnamed club" });
    await expect(founderApplication).toBeVisible();
    await expect(founderApplication).toContainText("Waiting for all members");

    // Each invitee joins with a separate test identity and accepts through the UI.
    const invitees = [];
    for (const actor of actors.slice(1)) {
      const page = await newClubsActor(browser, actor);
      invitees.push(page);
      pages.push(page);
      const accept = page.getByRole("button", { name: "Accept", exact: true });
      await expect(accept).toBeVisible();
      await clickAndExpectApi(
        page,
        accept,
        `/api/clubs/formation/${formationId}/respond`,
      );
      await expect(accept).toHaveCount(0);
      await expect(page.locator(".clubs-application").filter({ hasText: "Unnamed club" })).toBeVisible();
    }

    // The founder reloads to observe the acceptance committed by the other sessions.
    await loadClubs(founder, actors[0]);
    await expect(founder.getByPlaceholder("Propose the permanent club name")).toBeVisible();
    await founder.getByPlaceholder("Propose the permanent club name").fill(formationClubName);
    await clickAndExpectApi(
      founder,
      founder.getByRole("button", { name: "Propose Name", exact: true }),
      `/api/clubs/formation/${formationId}/name`,
    );
    const startVote = founder.getByRole("button", { name: "Start Captain Vote", exact: true });
    await clickAndExpectApi(
      founder,
      startVote,
      `/api/clubs/formation/${formationId}/captain/setup`,
    );
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
      await clickAndExpectApi(
        page,
        candidateButton,
        `/api/clubs/formation/${formationId}/captain/vote`,
      );
      await expect(page.locator(".clubs-captain-vote-head")).toContainText("Your vote is recorded");
    }

    // The founder votes last, which completes the all-members election.
    const founderCandidateButton = founder.locator(".clubs-vote-candidate").filter({ hasText: electedCandidateName });
    await expect(founderCandidateButton).toBeVisible();
    const completedVote = await clickAndExpectApi(
      founder,
      founderCandidateButton,
      `/api/clubs/formation/${formationId}/captain/vote`,
    );
    expect(completedVote.status).toBe("pendingCaptainDetailsApproval");
    const votedFormation = founder.locator(".clubs-application").filter({ hasText: formationClubName });
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
    const detailsResult = await clickAndExpectApi(
      captainPage,
      captainPage.getByRole("button", { name: "Approve Details", exact: true }),
      `/api/clubs/formation/${formationId}/details`,
    );
    expect(detailsResult.status).toBe("pendingAdminApproval");
    await expect(captainPage.getByText("All elected captain(s) approved the details. Waiting for administrator approval.")).toBeVisible();

    const admin = await newClubsActor(browser, { role: "admin" });
    pages.push(admin);
    await admin.getByRole("button", { name: /^Applications/ }).click();
    const application = admin.locator(".clubs-application").filter({ hasText: formationClubName });
    await expect(application).toBeVisible();
    await clickAndExpectApi(
      admin,
      application.getByRole("button", { name: "Approve", exact: true }),
      `/api/clubs/admin/applications/${formationId}/approve`,
      201,
    );
    await expect(admin.getByText("No Club formations are waiting for admin action.")).toBeVisible();
    await admin.getByRole("button", { name: "Clubs", exact: true }).click();
    await expect(admin.locator(".clubs-admin-directory-card").filter({ hasText: formationClubName })).toBeVisible();

    // Verify the approved Club from a member's refreshed browser view.
    await loadClubs(founder, actors[0]);
    await goToPrimaryTab(founder, "My Club");
    await expect(founder.getByRole("heading", { name: formationClubName, exact: true })).toBeVisible();
    await expect(founder.locator(".clubs-myclub-overview-stat").first()).toContainText("4/5");
    await expect(founder.getByRole("heading", { name: "Club timeline" })).toBeVisible();
  } finally {
    await Promise.allSettled(pages.map(page => page.close()));
  }
});

test("auction signing reserves budget and settles only after player choice and both captain approvals", async ({ browser }) => {
  test.setTimeout(120_000);
  const pages = [];
  const fixture = AUCTION_FIXTURES[Math.min(test.info().retry, AUCTION_FIXTURES.length - 1)];
  const auctionClubName = fixture.clubName;
  const auctionPlayers = fixture.players;
  const captainOne = await newClubsActor(browser, auctionPlayers.captainOne);
  pages.push(captainOne);

  try {
    await goToPrimaryTab(captainOne, "Market");
    await expect(captainOne.getByRole("heading", { name: "Send a signing offer" })).toBeVisible();
    const offerSelects = captainOne.locator("#clubs-auction-desk .clubs-invite-grid select");
    await expect.poll(
      () => offerSelects.nth(0).locator("option").allTextContents(),
      { timeout: 10_000 },
    ).toContain(auctionClubName);
    await offerSelects.nth(0).selectOption({ label: auctionClubName });
    await offerSelects.nth(1).selectOption(auctionPlayers.target.id);
    await captainOne.locator("#clubs-auction-desk input[type='number']").fill(AUCTION_AMOUNT);
    const createdOffer = await clickAndExpectApi(
      captainOne,
      captainOne.getByRole("button", { name: "Send Signing Offer", exact: true }),
      "/api/clubs/auction/offers",
      201,
    );
    const offerId = String(createdOffer._id);

    // The submitted offer reserves the Club budget without debiting it yet.
    await goToPrimaryTab(captainOne, "My Club");
    await expect(captainOne.getByRole("heading", { name: auctionClubName, exact: true })).toBeVisible();
    const reservedRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Reserved for offers" });
    const totalRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Total club funds" });
    await expect(reservedRow).toContainText("200");
    await expect(totalRow).toContainText("3,000");
    await expect(captainOne.locator(".clubs-myclub-overview-stat").first()).toContainText("4/5");

    const target = await newClubsActor(browser, { role: "editor", playerId: auctionPlayers.target.id });
    pages.push(target);
    await goToPrimaryTab(target, "Market");
    await expect(target.getByRole("heading", { name: "Offers made to you" })).toBeVisible();
    const chooseOffer = target.getByRole("button", { name: "Choose this club", exact: true });
    await expect(chooseOffer).toBeVisible();
    const chosenOffer = await clickAndExpectApi(
      target,
      chooseOffer,
      `/api/clubs/auction/offers/${offerId}/choose`,
    );
    expect(chosenOffer.status).toBe("chosenByPlayer");

    // A chosen offer is not a completed signing: the target still has no Club and no payment.
    await goToPrimaryTab(target, "My Club");
    await expect(target.locator(".clubs-myclub-empty")).toContainText("You are not currently under a Club contract.");
    await expect(target.locator(".clubs-wallet-main-value")).toHaveText("0");

    await goToPrimaryTab(captainOne, "Market");
    const incomingOffer = captainOne.locator(".clubs-application").filter({ hasText: auctionPlayers.target.name });
    await expect(incomingOffer.getByRole("button", { name: "Approve signing", exact: true })).toBeVisible();
    const firstCaptainApproval = await clickAndExpectApi(
      captainOne,
      incomingOffer.getByRole("button", { name: "Approve signing", exact: true }),
      `/api/clubs/auction/offers/${offerId}/approve`,
    );
    expect(firstCaptainApproval.pendingCaptainApproval).toBe(true);

    // One approval cannot finalize the transaction or consume the reserved balance.
    await goToPrimaryTab(captainOne, "My Club");
    await expect(captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Reserved for offers" })).toContainText("200");
    await expect(captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Total club funds" })).toContainText("3,000");
    await expect(captainOne.locator(".clubs-myclub-overview-stat").first()).toContainText("4/5");
    await expect(target.locator(".clubs-wallet-main-value")).toHaveText("0");

    const captainTwo = await newClubsActor(browser, auctionPlayers.captainTwo);
    pages.push(captainTwo);
    await goToPrimaryTab(captainTwo, "Market");
    const secondCaptainOffer = captainTwo.locator(".clubs-application").filter({ hasText: auctionPlayers.target.name });
    await expect(secondCaptainOffer.getByRole("button", { name: "Approve signing", exact: true })).toBeVisible();
    const finalizedSigning = await clickAndExpectApi(
      captainTwo,
      secondCaptainOffer.getByRole("button", { name: "Approve signing", exact: true }),
      `/api/clubs/auction/offers/${offerId}/approve`,
    );
    expect(finalizedSigning.offer.status).toBe("approved");

    // The second captain completes the signing: wallet commitment settles exactly once.
    await loadClubs(captainOne, auctionPlayers.captainOne);
    await goToPrimaryTab(captainOne, "My Club");
    await expect(captainOne.getByRole("heading", { name: auctionClubName, exact: true })).toBeVisible();
    const finalReservedRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Reserved for offers" });
    const finalTotalRow = captainOne.locator(".clubs-command-budget-breakdown div").filter({ hasText: "Total club funds" });
    await expect(finalReservedRow).toContainText("0");
    await expect(finalTotalRow).toContainText("2,800");
    await expect(captainOne.locator(".clubs-myclub-overview-stat").first()).toContainText("5/5");
    await expect(captainOne.locator(".clubs-roster-premium-row").filter({ hasText: auctionPlayers.target.name })).toBeVisible();

    await loadClubs(target, { role: "editor", playerId: auctionPlayers.target.id });
    await goToPrimaryTab(target, "My Club");
    await expect(target.getByRole("heading", { name: auctionClubName, exact: true })).toBeVisible();
    await expect(target.locator(".clubs-wallet-main-value")).toHaveText("200");
    await expect(target.locator(".clubs-roster-premium-row").filter({ hasText: auctionPlayers.target.name })).toBeVisible();
  } finally {
    await Promise.allSettled(pages.map(page => page.close()));
  }
});

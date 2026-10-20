import { test, expect } from "@playwright/test";

async function enterMatchday(page, role, playerId) {
  const query = playerId ? `?e2eRole=${role}&e2ePlayerId=${playerId}` : `?e2eRole=${role}&e2ePlayerId=unlinked`;
  await page.goto("/" + query);
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
}

test("player can inspect canonical rating breakdown and submit a non-mutating dispute", async ({ page }) => {
  await enterMatchday(page, "editor", "65a000000000000000000001");
  await page.getByRole("button", { name: "Calendar" }).first().click();

  const matchCard = page.locator(".gg-match-open").filter({ hasText: "E2E Rating Explanation Match" });
  await expect(matchCard).toBeVisible();
  await matchCard.click();

  const playerRow = page.locator(".gg-match-performance-table tbody tr").filter({ hasText: "E2E Player One" });
  await expect(playerRow).toBeVisible();
  await playerRow.getByRole("button", { name: "Explain rating" }).click();

  const explanation = page.locator(".rating-explanation-panel");
  await expect(explanation.getByRole("heading", { name: /E2E Player One · Why this rating/ })).toBeVisible();
  await expect(explanation.getByText("Goals", { exact: true })).toBeVisible();
  await expect(explanation.getByText("Defensive rating", { exact: true })).toBeVisible();
  await expect(explanation.getByText(/saved value matches the canonical calculation/).first()).toBeVisible();

  await explanation.getByRole("button", { name: "Report an issue" }).click();
  await explanation.getByLabel("What is this about?").selectOption("match-rating");
  await explanation.getByLabel("Explain your concern (10–1,000 characters)").fill("Please review the saved match rating and its recorded performance inputs.");
  await explanation.getByRole("button", { name: "Submit for review" }).click();

  await expect(explanation.getByRole("status").filter({ hasText: "Dispute submitted for admin review" })).toBeVisible();
  await expect(explanation.getByText(/Your dispute is Awaiting review/)).toBeVisible();
});

test("admin can record a reasoned dispute decision without touching the match record", async ({ page }) => {
  await enterMatchday(page, "admin");
  await page.getByRole("button", { name: /Admin/ }).first().click();

  const tools = page.locator(".gg-admin-tools");
  await expect(tools.getByRole("heading", { name: "Historical Migration & Audit" })).toBeVisible();
  await tools.getByRole("button", { name: "Player rating disputes" }).click();

  const dispute = page.locator(".gg-dispute-card").filter({ hasText: "E2E Player Two · E2E Rating Explanation Match" });
  await expect(dispute).toBeVisible();
  await expect(dispute).toContainText("Please review this seeded defensive and match rating concern.");
  await dispute.getByLabel(/Admin review note/).fill("Reviewed the persisted facts and canonical breakdown; no correction is warranted.");
  await dispute.getByRole("button", { name: "Resolve — no change" }).click();

  await expect(dispute).toContainText("Resolved — no change");
  await expect(dispute).toContainText("Reviewed the persisted facts and canonical breakdown; no correction is warranted.");
  await expect(dispute.locator(".gg-dispute-history")).toContainText("resolved no change");
});

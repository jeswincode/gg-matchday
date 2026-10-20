import { test, expect } from "@playwright/test";

test("Clubs operations queue drives an administrator approval and records the action", async ({ page }) => {
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.locator(".clubs-app")).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Clubs admin navigation" });
  await expect(navigation.getByRole("button", { name: "Dashboard" })).toBeVisible();

  const queueItem = page.locator(".clubs-operations-item").filter({ hasText: "E2E Operations Review FC" });
  await expect(queueItem).toBeVisible();
  await expect(queueItem).toContainText("Review application");
  await queueItem.getByRole("button", { name: "Review application", exact: true }).click();

  const application = page.locator(".clubs-application").filter({ hasText: "E2E Operations Review FC" });
  await expect(application).toBeVisible();
  await application.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Club formation approved.")).toBeVisible();

  await navigation.getByRole("button", { name: "Dashboard" }).click();
  await expect(page.locator(".clubs-operations-item").filter({ hasText: "E2E Operations Review FC" })).toHaveCount(0);

  await page.getByRole("button", { name: "Activity & audit", exact: true }).click();
  await expect(page.locator(".clubs-operations-activity-item").filter({ hasText: "formation approve" })).toBeVisible();
  await expect(page.locator(".clubs-operations-activity-item").filter({ hasText: "Administrator approved a fully captain-approved Club formation." })).toBeVisible();
});

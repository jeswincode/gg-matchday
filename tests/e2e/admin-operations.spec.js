import { test, expect } from "@playwright/test";

test("Clubs operations queue drives an administrator approval and records the action", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.locator(".clubs-app")).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Clubs admin navigation" });
  const menu = page.getByRole("button", { name: "Open Clubs admin sections" });
  async function openAdminTab(name) {
    if (await menu.isVisible()) await menu.click();
    await navigation.getByRole("button", { name, exact: true }).click();
  }
  await openAdminTab("Dashboard");
  await expect(page.getByRole("button", { name: /Profile Admin|Player Profile/ })).toHaveCount(0);

  const metrics = page.getByRole("region", { name: "Clubs operational metrics" });
  await expect(metrics.getByRole("button")).toHaveCount(4);
  await expect(metrics.getByRole("button", { name: /Wallet discrepancies/ }).locator("strong")).toHaveText(/^\d+$/);
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Club admin shortcuts" }).getByRole("button", { name: /Track matches/ })).toBeVisible();
  await metrics.getByRole("button", { name: /Pending approvals/ }).click();
  await expect(page.getByRole("heading", { name: "Action queue", exact: true })).toBeVisible();
  await expect(page.getByLabel("Severity")).toBeHidden();
  await page.getByRole("button", { name: "More filters" }).click();
  await expect(page.getByLabel("Severity")).toBeVisible();
  await page.getByRole("button", { name: "Fewer filters" }).click();
  await expect(page.getByLabel("Issue type")).toHaveValue("formation");

  const queueItem = page.locator(".clubs-operations-item").filter({ hasText: "E2E Operations Review FC" });
  await expect(queueItem).toBeVisible();
  await queueItem.getByRole("button", { name: "Details", exact: true }).click();
  await expect(queueItem.getByRole("region", { name: /Details for/ })).toBeVisible();
  await expect(queueItem).toContainText("Review application");
  await queueItem.getByRole("button", { name: "Review application", exact: true }).click();

  const application = page.locator(".clubs-application").filter({ hasText: "E2E Operations Review FC" });
  await expect(application).toBeVisible();
  await expect(application).toBeFocused();
  await application.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Club formation approved.")).toBeVisible();

  await openAdminTab("Dashboard");
  await expect(metrics.getByRole("button", { name: /Pending approvals/ }).locator("strong")).toHaveText("0");
  await expect(page.locator(".clubs-operations-item").filter({ hasText: "E2E Operations Review FC" })).toHaveCount(0);

  await page.getByRole("button", { name: "View audit log", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activity & audit", exact: true })).toBeVisible();
  await expect(page.locator(".clubs-operations-activity-item").filter({ hasText: "Formation approval" })).toBeVisible();
  await expect(page.locator(".clubs-operations-activity-item").filter({ hasText: "Administrator approved a fully captain-approved Club formation." })).toBeVisible();
  await page.getByLabel("Event type").selectOption("clubMatch");
  await expect(page.locator(".clubs-operations-activity-item").filter({ hasText: "Formation approval" })).toHaveCount(0);
  await openAdminTab("Matches");
  await expect(page.getByLabel("Search fixtures")).toBeVisible();
});

test("Profile administration selects its sidebar item and removes an account after linking", async ({ page }) => {
  await page.goto("/?e2eRole=admin&e2ePlayerId=unlinked");
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  const avatar = page.getByRole("button", { name: "Account profile settings" });
  await avatar.click();
  const settings = page.getByRole("dialog", { name: "Account profile settings" });
  await expect(settings.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Linked player profile" })).toHaveCount(0);
  await settings.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "⚙ Admin", exact: true }).click();
  await expect(page.getByRole("region", { name: "GG Matchday admin control center" })).toBeVisible();
  const mobileMenu = page.getByRole("button", { name: "Open admin sections" });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  const sidebarEntry = page.getByRole("button", { name: "Profile administration", exact: true, includeHidden: true });
  await sidebarEntry.click();
  const profileAdmin = page.getByRole("dialog", { name: "Profile Administration", exact: true });
  await expect(profileAdmin).toBeVisible();
  await expect(sidebarEntry).toHaveAttribute("aria-current", "page");
  const account = profileAdmin.getByLabel("Unlinked account");
  const unlinked = account.getByRole("option", { name: /E2E Unlinked Profile Account/ });
  await expect(unlinked).toHaveCount(1);
  await expect(account.getByRole("option", { name: /E2E Dispute Reporter/i })).toHaveCount(0);
  await expect(account.getByRole("option", { name: /Playwright admin/i })).toHaveCount(0);
  await account.selectOption(await unlinked.getAttribute("value"));
  await profileAdmin.getByLabel("Player", { exact: true }).selectOption({ label: "E2E Player One" });
  await profileAdmin.getByRole("button", { name: "Link account", exact: true }).click();
  await expect(profileAdmin.getByRole("status")).toHaveText("Account linked to player profile.");
  await expect(unlinked).toHaveCount(0);
  await profileAdmin.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sidebarEntry).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Profile administration", exact: true })).toBeVisible();
});

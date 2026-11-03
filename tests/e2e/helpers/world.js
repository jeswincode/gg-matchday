import { expect } from "@playwright/test";

export async function enterWorldFromGlobalMap(page) {
  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await page.getByRole("button", { name: "Preview Original GG" }).click({ force: true });
  await expect(page.locator(".gg-world-screen-interior")).toBeVisible({ timeout: 10_000 });
}

export async function openLinkedWorld(page, { role = "editor", playerId = null } = {}) {
  const query = new URLSearchParams({ e2eRole: role });
  if (playerId) query.set("e2ePlayerId", playerId);
  else query.set("e2ePlayerId", "unlinked");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?" + query.toString());
  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await enterWorldFromGlobalMap(page);
}

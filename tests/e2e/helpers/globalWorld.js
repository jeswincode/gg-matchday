import { expect } from "@playwright/test";

export async function enterOriginalWorld(page, {
  role = "editor",
  playerId = role === "admin" ? "unlinked" : "65a000000000000000000001",
} = {}) {
  const query = new URLSearchParams({ e2eRole: role, e2ePlayerId: playerId });
  await page.goto("/?" + query.toString());

  await expect(page.getByRole("button", { name: "Enter Matchday" })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();

  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.getByRole("heading", { name: "One World. One shared football home." })).toBeVisible();
  await page.getByRole("button", { name: "Preview Original GG" }).click();

  await expect(page.getByRole("button", { name: "Enter Football World" })).toBeVisible();
  await page.getByRole("button", { name: "Enter Football World" }).click();

  await expect(page.locator(".gg-world-screen-interior")).toBeVisible();
  await expect(page.getByRole("region", { name: "Original GG World map" })).toBeVisible();
}

export async function enterGuestGlobalMap(page) {
  await page.goto("/?e2eRole=guest");
  await page.getByRole("button", { name: "Explore the Global Map as Guest" }).click();
  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.getByRole("heading", { name: "One World. One shared football home." })).toBeVisible();
}

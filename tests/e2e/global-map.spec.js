import { test, expect } from "@playwright/test";

test("guest opens the Global Map, inspects the isometric canvas and sees the install option", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?e2eRole=guest");

  await expect(page.getByRole("button", { name: "Explore the Global Map as Guest" })).toBeVisible();
  await page.getByRole("button", { name: "Explore the Global Map as Guest" }).click();

  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.getByText("GLOBAL MAP", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Global World map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install GG as an app" })).toBeVisible();

  const camera = page.locator(".gg-global-map-camera");
  const before = await camera.getAttribute("transform");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => camera.getAttribute("transform")).not.toBe(before);
  expect(pageErrors).toEqual([]);
});

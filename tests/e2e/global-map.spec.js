import { test, expect } from "@playwright/test";

test("guest opens the Global Map, inspects the isometric canvas and sees the install option", async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", request => failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || "unknown",
  }));

  await page.goto("/?e2eRole=guest");
  await page.waitForTimeout(1400);
  console.log("GG E2E guest startup diagnostic", JSON.stringify({
    body: (await page.locator("body").innerText()).slice(0, 1800),
    pageErrors,
    consoleErrors: consoleErrors.slice(-12),
    failedRequests: failedRequests.slice(-12),
  }));
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

test("signing out clears the private World interior before returning to public entry", async ({ page }) => {
  await openLinkedWorld(page, { role: "editor", playerId: "65a000000000000000000001" });
  await expect(page.locator(".gg-world-screen-interior")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Explore the Global Map as Guest" })).toBeVisible();
  await expect(page.locator(".gg-world-screen-interior")).toHaveCount(0);
  await expect(page.locator(".gg-world-bottom-nav")).toHaveCount(0);

  await page.getByRole("button", { name: "Explore the Global Map as Guest" }).click();
  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.locator(".gg-world-screen-interior")).toHaveCount(0);
  await expect(page.locator(".gg-world-bottom-nav")).toHaveCount(0);
});

test("an open private map is cleared when membership is revoked during focus revalidation", async ({ page }) => {
  await openLinkedWorld(page, { role: "editor", playerId: "65a000000000000000000001" });
  await expect(page.locator(".gg-world-screen-interior")).toBeVisible();

  await page.route("**/api/worlds/me", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      worlds: [{
        slug: "original-gg",
        membership: { role: "editor", status: "revoked", playerProfileId: null },
      }],
    }),
  }));

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.locator(".gg-world-screen-interior")).toHaveCount(0);
  await expect(page.locator(".gg-world-bottom-nav")).toHaveCount(0);
  await expect(page.getByText("Access to the GG football World is no longer active. Contact the platform administrator.")).toBeVisible();
});

test("a protected Clubs API denial returns the user to the public World map", async ({ page }) => {
  await openLinkedWorld(page, { role: "editor", playerId: "65a000000000000000000001" });
  await page.route("**/api/clubs/meta", route => route.fulfill({
    status: 403,
    contentType: "application/json",
    body: JSON.stringify({
      message: "This Gmail account has not been linked by the GG platform administrator.",
      code: "WORLD_ACCESS_GRANT_REQUIRED",
    }),
  }));

  await page.getByRole("button", { name: "Clubs", exact: true }).click();
  await expect(page.locator(".clubs-app")).toBeVisible();
  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.locator(".clubs-app")).toHaveCount(0);
  await expect(page.locator(".gg-world-screen-interior")).toHaveCount(0);
});
import { test, expect } from "@playwright/test";
import { openLinkedWorld } from "./helpers/world.js";

test("guest opens the Global Map, inspects the isometric canvas and sees the install option", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?e2eRole=guest");

  await expect(page.getByRole("button", { name: "Explore the Global Map as Guest" })).toBeVisible();
  await page.getByRole("button", { name: "Explore the Global Map as Guest" }).click();

  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.locator(".gg-world-bottom-nav")).toHaveCount(0);
  await expect(page.getByText("GLOBAL MAP", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Global World map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install GG as an app" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Original GG" })).toBeVisible();
  await page.getByRole("button", { name: "Preview Original GG" }).click();
  await expect(page.getByRole("button", { name: "Access by invitation only" })).toBeDisabled();
  await expect(page.locator(".gg-world-screen-interior")).toHaveCount(0);

  const camera = page.locator(".gg-global-map-camera");
  const before = await camera.getAttribute("transform");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => camera.getAttribute("transform")).not.toBe(before);
  const wheelBefore = await camera.getAttribute("transform");
  await page.locator(".gg-global-map-viewport").evaluate(element => {
    element.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -120 }));
  });
  await expect.poll(() => camera.getAttribute("transform")).not.toBe(wheelBefore);

  const pinchBefore = await camera.getAttribute("transform");
  await page.locator(".gg-global-map-viewport").evaluate(element => {
    element.setPointerCapture = () => {};
    element.releasePointerCapture = () => {};
    const target = element.querySelector(".gg-global-map-kingdom");
    const bounds = target.getBoundingClientRect();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    const pointer = (type, id, clientX) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      pointerId: id,
      pointerType: "touch",
      isPrimary: id === 1,
      clientX,
      clientY: y,
      button: 0,
    }));
    pointer("pointerdown", 1, x - 40);
    pointer("pointerdown", 2, x + 40);
    pointer("pointermove", 2, x + 80);
    pointer("pointerup", 2, x + 80);
    pointer("pointerup", 1, x - 40);
  });
  await expect.poll(() => camera.getAttribute("transform")).not.toBe(pinchBefore);
  expect(pageErrors).toEqual([]);
});

test("global and local maps support wheel zoom and two-pointer pinch gestures", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLinkedWorld(page, { role: "editor", playerId: "65a000000000000000000001" });
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

  const localMap = page.getByRole("region", { name: "Original GG World map" });
  const localViewport = localMap.locator(".gg-world-map-viewport");
  const localCamera = localMap.locator(".gg-world-map-camera");
  const localBefore = await localCamera.getAttribute("transform");
  await localViewport.evaluate(element => {
    // Exercise pinch starting directly over a facility, not only empty terrain.
    element.setPointerCapture = () => {};
    element.releasePointerCapture = () => {};
    const target = element.querySelector(".gg-world-facility");
    const bounds = target.getBoundingClientRect();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    const pointer = (type, id, clientX) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      pointerId: id,
      pointerType: "touch",
      isPrimary: id === 1,
      clientX,
      clientY: y,
      button: 0,
    }));
    pointer("pointerdown", 1, x - 40);
    pointer("pointerdown", 2, x + 40);
    pointer("pointermove", 2, x + 80);
    pointer("pointerup", 2, x + 80);
    pointer("pointerup", 1, x - 40);
  });
  await expect.poll(() => localCamera.getAttribute("transform")).not.toBe(localBefore);
});

test("linked member enters the private local map and explores its facilities on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await openLinkedWorld(page, {
    role: "editor",
    playerId: "65a000000000000000000001",
  });

  const localMap = page.getByRole("region", { name: "Original GG World map" });
  await expect(localMap).toBeVisible();
  await expect(localMap.locator(".gg-world-facility")).toHaveCount(8);
  await expect(localMap.getByRole("button", { name: "Select Training Grounds facility" })).toBeVisible();

  await localMap.getByRole("button", { name: "Select Training Grounds facility" }).click();
  await expect(page.getByRole("heading", { name: "Training Grounds" })).toBeVisible();
  await expect(page.getByText("Read-only map access")).toBeVisible();

  const mapCamera = localMap.locator(".gg-world-map-camera");
  const before = await mapCamera.getAttribute("transform");
  await localMap.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => mapCamera.getAttribute("transform")).not.toBe(before);

  const viewport = await localMap.locator(".gg-world-map-viewport").boundingBox();
  const svgBounds = await localMap.locator(".gg-world-map-svg").boundingBox();
  expect(viewport).not.toBeNull();
  expect(svgBounds).not.toBeNull();
  expect(Math.abs((svgBounds.x + svgBounds.width / 2) - (viewport.x + viewport.width / 2))).toBeLessThan(2);
  expect(pageErrors).toEqual([]);
});

test("linked World members can open the preserved Matchday Journal and return to the map", async ({ page }) => {
  await openLinkedWorld(page, { role: "editor", playerId: "65a000000000000000000001" });

  await page.getByRole("button", { name: "Journal" }).click();
  await expect(page.getByRole("heading", { name: "Matchday Journal" })).toBeVisible();
  await expect(page.locator(".home-feature-card .feature-label")).toContainText("MATCHDAY MOMENT");
  await expect(page.getByRole("button", { name: "Back to World Map" })).toBeVisible();

  await page.getByRole("button", { name: "Back to World Map" }).click();
  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
});

test("platform administrator can move a local facility from the map controls", async ({ page }) => {
  await openLinkedWorld(page, { role: "admin" });

  const localMap = page.getByRole("region", { name: "Original GG World map" });
  await expect(localMap.getByRole("button", { name: "Move north" })).toBeVisible();
  await localMap.getByRole("button", { name: "Move north" }).click();

  await expect(page.getByText("Central Stadium placement saved.")).toBeVisible();
  await expect(localMap.locator(".gg-world-map-version")).toHaveText("LAYOUT v2");
  await expect(localMap.getByRole("button", { name: "Move north" })).toBeEnabled();
});

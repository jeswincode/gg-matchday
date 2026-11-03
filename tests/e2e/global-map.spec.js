import { test, expect } from "@playwright/test";
import { openLinkedWorld } from "./helpers/world.js";

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
  expect(pageErrors).toEqual([]);
});

test("global and local maps support wheel zoom and two-pointer pinch gestures", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLinkedWorld(page, { role: "editor", playerId: "65a000000000000000000001" });

  const localMap = page.getByRole("region", { name: "Original GG World map" });
  const localViewport = localMap.locator(".gg-world-map-viewport");
  const localCamera = localMap.locator(".gg-world-map-camera");
  const localBefore = await localCamera.getAttribute("transform");
  await localViewport.evaluate(element => {
    // Synthetic pointer events are not registered by the browser input router;
    // stub capture while exercising the React gesture state machine itself.
    element.setPointerCapture = () => {};
    element.releasePointerCapture = () => {};
    const pointer = (type, id, x, y) => {
      const event = new PointerEvent(type, {
        bubbles: true,
        pointerId: id,
        pointerType: "touch",
        isPrimary: id === 1,
        clientX: x,
        clientY: y,
        button: 0,
      });
      element.dispatchEvent(event);
    };
    pointer("pointerdown", 1, 100, 200);
    pointer("pointerdown", 2, 200, 200);
    pointer("pointermove", 2, 260, 200);
    pointer("pointerup", 2, 260, 200);
    pointer("pointerup", 1, 100, 200);
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

test("platform administrator can move a local facility from the map controls", async ({ page }) => {
  await openLinkedWorld(page, { role: "admin" });

  const localMap = page.getByRole("region", { name: "Original GG World map" });
  await expect(localMap.getByRole("button", { name: "Move north" })).toBeVisible();
  await localMap.getByRole("button", { name: "Move north" }).click();

  await expect(page.getByText("Central Stadium placement saved.")).toBeVisible();
  await expect(localMap.locator(".gg-world-map-version")).toHaveText("LAYOUT v2");
  await expect(localMap.getByRole("button", { name: "Move north" })).toBeEnabled();
});

import { expect } from "@playwright/test";

export async function enterWorldFromGlobalMap(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // World context intentionally survives a reload in sessionStorage. Check
  // the persisted selector first: the Global Map briefly renders while its
  // restore request is in flight, so DOM-only branching can race that transition.
  const activeWorldSlug = await page.evaluate(() =>
    window.sessionStorage.getItem("gg.activeWorldSlug"),
  );
  if (activeWorldSlug === "original-gg") {
    await expect(page.locator(".gg-world-screen-interior")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("region", { name: "Original GG World map" })).toBeVisible();
    return;
  }
  await expect(page.locator(".gg-world-screen-global")).toBeVisible();
  await expect(page.getByRole("heading", { name: "One World. One shared football home." })).toBeVisible();
  await page.getByRole("button", { name: "Preview Original GG" }).click();
  await expect(page.getByRole("button", { name: "Enter Football World" })).toBeVisible();

  const mapResponsePromise = page.waitForResponse(response =>
    response.url().includes("/api/worlds/original-gg/map") &&
    response.request().method() === "GET",
    { timeout: 12_000 },
  );
  await page.getByRole("button", { name: "Enter Football World" }).click();
  const mapResponse = await mapResponsePromise;
  const mapPayload = await mapResponse.json().catch(() => ({}));
  console.log("[E2E World map entry]", {
    status: mapResponse.status(),
    code: mapPayload?.code || null,
    message: mapPayload?.message || null,
    facilities: mapPayload?.facilities?.length ?? null,
  });
  expect(mapResponse.ok(), JSON.stringify(mapPayload)).toBeTruthy();
  await expect(page.locator(".gg-world-screen-interior")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Original GG World map" })).toBeVisible();
}

export async function openLinkedWorld(page, { role = "editor", playerId = null } = {}) {
  const query = new URLSearchParams({ e2eRole: role });
  if (playerId) query.set("e2ePlayerId", playerId);
  else query.set("e2ePlayerId", "unlinked");

  await page.goto("/?" + query.toString());

  // Prove the test identity receives the expected one-World access state
  // independently of the React map rendering. This keeps auth regressions
  // distinguishable from map/navigation regressions.
  const playerIdForAuth = playerId || "unlinked";
  const accessResponse = await page.request.get("http://127.0.0.1:5000/api/worlds/me", {
    headers: {
      "X-E2E-Test-Token": "gg-matchday-e2e-only-secret",
      "X-E2E-Test-Role": role,
      "X-E2E-Test-Player-Id": playerIdForAuth,
    },
  });
  const accessPayload = await accessResponse.json().catch(() => ({}));
  console.log("[E2E World access]", {
    role,
    playerId: playerIdForAuth,
    status: accessResponse.status(),
    membership: accessPayload?.worlds?.[0]?.membership || null,
    code: accessPayload?.code || null,
  });
  expect(accessResponse.ok(), JSON.stringify(accessPayload)).toBeTruthy();
  expect(accessPayload?.worlds?.[0]?.membership?.status).toBe("active");

  await expect(page.getByRole("img", { name: /GG Matchday cinematic football poster/i })).toBeVisible();
  await page.getByRole("button", { name: "Enter Matchday" }).click();
  await enterWorldFromGlobalMap(page);
}

import { expect } from "@playwright/test";

export async function completeMobileEntry(page) {
  const needsPrompt = await page.evaluate(() =>
    window.matchMedia("(max-width: 767px), (hover: none) and (pointer: coarse)").matches &&
    !document.fullscreenElement,
  );
  if (!needsPrompt) return false;

  await page.getByRole("button", { name: "Enter Fullscreen", exact: true }).click();
  await expect(page.locator(".gg-matchday-intro--mobile")).toBeHidden();
  return true;
}

export async function enterSignedInMatchday(page) {
  if (!(await completeMobileEntry(page))) {
    const prompt = page.getByRole("button", { name: "PRESS TO CONTINUE", exact: true });
    const navigation = page.getByRole("navigation", { name: "Matchday tabs" });
    await expect(prompt.or(navigation)).toBeVisible();
    if (await prompt.isVisible()) await prompt.click();
  }
}

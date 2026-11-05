import test from "node:test";
import assert from "node:assert/strict";
import { AVATAR_OPTIONS, WORLD_COSMETIC_CATALOG, WORLD_COSMETIC_CATEGORIES, getWorldCosmetic } from "../shared/worldCustomization.js";
import { FREE_AVATAR_OPTIONS } from "../shared/worldAvatarOptions.js";

test("cosmetic catalogue is data-driven, uniquely keyed and category-complete", () => {
  const ids = WORLD_COSMETIC_CATALOG.map((item) => item.id);
  assert.ok(ids.length >= 12);
  assert.equal(new Set(ids).size, ids.length);
  const categories = new Set(WORLD_COSMETIC_CATEGORIES.map((category) => category.id));
  for (const item of WORLD_COSMETIC_CATALOG) {
    assert.ok(categories.has(item.category), item.id+" has a registered category");
    assert.ok(item.slot);
    assert.ok(Number.isInteger(item.price) && item.price > 0);
    assert.ok(Number.isInteger(item.minLevel) && item.minLevel >= 1);
    assert.ok(item.appearancePatch && Object.keys(item.appearancePatch).length > 0);
    for (const [field, value] of Object.entries(item.appearancePatch)) {
      assert.ok(AVATAR_OPTIONS[field]?.includes(value), item.id+" uses a valid "+field+" option");
    }
  }
  assert.equal(getWorldCosmetic("kit-neon").appearancePatch.kitPrimary, "teal");
  assert.equal(getWorldCosmetic("not-a-real-item"), null);
});

test("shop-only appearance variants are not included in the free avatar editor", () => {
  assert.ok(FREE_AVATAR_OPTIONS.hairColor.includes("black"));
  assert.ok(!FREE_AVATAR_OPTIONS.hairColor.includes("silver"));
  assert.ok(!FREE_AVATAR_OPTIONS.hairStyle.includes("bun"));
  assert.ok(!FREE_AVATAR_OPTIONS.kitPrimary.includes("teal"));
  assert.ok(!FREE_AVATAR_OPTIONS.bootColor.includes("cyan"));
  assert.ok(!FREE_AVATAR_OPTIONS.headAccessory.includes("gold-headband"));
});

test("new cosmetic options remain supported by the persisted appearance schema", () => {
  assert.ok(AVATAR_OPTIONS.hairStyle.includes("ponytail"));
  assert.ok(AVATAR_OPTIONS.hairStyle.includes("side-part"));
  assert.ok(AVATAR_OPTIONS.hairColor.includes("pink"));
  assert.ok(AVATAR_OPTIONS.kitPrimary.includes("maroon"));
  assert.ok(AVATAR_OPTIONS.bootColor.includes("cyan"));
  assert.ok(AVATAR_OPTIONS.headAccessory.includes("blue-headband"));
});

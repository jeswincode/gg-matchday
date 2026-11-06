import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WORLD_LAYOUT, WORLD_MAP_SLUG } from "../server/config/ggWorldRules.js";
import { createPublicWorldMapProjection } from "../server/services/worldMapProjection.js";

test("public map exposes the one canonical Original GG world", () => {
  const map = createPublicWorldMapProjection(DEFAULT_WORLD_LAYOUT);
  assert.equal(map.slug, WORLD_MAP_SLUG);
  assert.equal(map.slug, "original-gg");
  assert.ok(map.locations.some((item) => item.id === "gg-hq"));
  assert.ok(map.districts.length > 0);
});

test("public map strips private interiors, ownership and all gameplay collections", () => {
  const map = createPublicWorldMapProjection({
    ...DEFAULT_WORLD_LAYOUT,
    plots: [{ id: "plot-secret", ownerPlayerId: "owner-secret" }],
    locations: [{
      ...DEFAULT_WORLD_LAYOUT.locations[0],
      interior: { rooms: [{ id: "private-room" }] },
      ownerPlayerId: "owner-secret",
      visitorPlayerIds: ["visitor-secret"],
      privacy: "private",
    }],
  });
  for (const key of ["plots", "presence", "residences", "training", "messages", "economy"]) assert.equal(Object.hasOwn(map, key), false);
  for (const key of ["interior", "ownerPlayerId", "visitorPlayerIds", "privacy"]) assert.equal(Object.hasOwn(map.locations[0], key), false);
});

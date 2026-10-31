import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveWorldSlug,
  setActiveWorldSlug,
  worldContextHeaders,
} from "../src/lib/worldContext.js";

test("active World selector is normalized and attached to API requests", () => {
  setActiveWorldSlug(null);
  assert.equal(getActiveWorldSlug(), null);
  assert.deepEqual(worldContextHeaders(), {});

  assert.equal(setActiveWorldSlug(" Original-GG "), "original-gg");
  assert.equal(getActiveWorldSlug(), "original-gg");
  assert.deepEqual(worldContextHeaders(), { "X-World-Slug": "original-gg" });

  setActiveWorldSlug(null);
  assert.equal(getActiveWorldSlug(), null);
});

test("active World selector rejects invalid slugs", () => {
  assert.throws(() => setActiveWorldSlug("../admin"), /valid World slug/);
  assert.throws(() => setActiveWorldSlug("x"), /valid World slug/);
});

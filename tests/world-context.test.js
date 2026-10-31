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

test("active World selection survives a page reload for the browser session", () => {
  const previousWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    },
  };

  try {
    setActiveWorldSlug("original-gg");
    assert.equal(values.get("gg.activeWorldSlug"), "original-gg");

    // Simulate a fresh module instance after a browser reload.
    setActiveWorldSlug(null);
    values.set("gg.activeWorldSlug", "another-world");
    assert.equal(getActiveWorldSlug(), "another-world");
    assert.deepEqual(worldContextHeaders(), { "X-World-Slug": "another-world" });

    setActiveWorldSlug(null);
    assert.equal(values.has("gg.activeWorldSlug"), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("active World selector rejects invalid slugs", () => {
  assert.throws(() => setActiveWorldSlug("../admin"), /valid World slug/);
  assert.throws(() => setActiveWorldSlug("x"), /valid World slug/);
});

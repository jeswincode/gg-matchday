import test from "node:test";
import assert from "node:assert/strict";

const positionGroup = position => {
  const value = String(position || "").toUpperCase();
  if (/GK|GOALKEEP/.test(value)) return "GK";
  if (/CB|LB|RB|LWB|RWB|DEF/.test(value)) return "DEF";
  if (/CDM|CM|CAM|LM|RM|MID/.test(value)) return "MID";
  if (/ST|CF|LW|RW|ATT|FORWARD/.test(value)) return "ATT";
  return "UNK";
};

test("tactical role recognition covers recognised football position families", () => {
  assert.equal(positionGroup("GK"), "GK");
  assert.equal(positionGroup("CB"), "DEF");
  assert.equal(positionGroup("CAM"), "MID");
  assert.equal(positionGroup("ST"), "ATT");
  assert.equal(positionGroup("Unknown"), "UNK");
});

test("tactical practice is independent of GG ratings and Club economy modules", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/features/play/PlayCentre.jsx", import.meta.url), "utf8"));
  assert.match(source, /Practice simulation only/);
  assert.match(source, /GG Match ratings/);
  assert.match(source, /Club Wallets/);
  assert.doesNotMatch(source, /api\\(["']\\/clubs\\/wallet/);
  assert.doesNotMatch(source, /api\\(["']\\/matches/);
});

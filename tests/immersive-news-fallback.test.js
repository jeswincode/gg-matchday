import test from "node:test";
import assert from "node:assert/strict";
import { buildFallbackImmersiveNews } from "../server/services/immersiveNewsFallback.js";

test("immersive fallback describes a Team A win using only the recorded score", () => {
  const result = buildFallbackImmersiveNews({
    name: "Sunday Final",
    side1: { label: "Blue", score: 3 },
    side2: { label: "Gold", score: 1 },
  });

  assert.equal(result.generatedBy, "fallback");
  assert.equal(result.momentText, "Blue beat Gold 3-1.");
  assert.equal(result.headline, "Blue take the win in Sunday Final");
  assert.equal(result.summary, "Blue beat Gold 3-1.");
  assert.match(result.body, /Blue scored 3, while Gold scored 1/);
  assert.equal(result.icon, "🏆");
});

test("immersive fallback reverses winner and loser correctly for a Team B win", () => {
  const result = buildFallbackImmersiveNews({
    name: "Sunday Final",
    side1: { label: "Blue", score: 0 },
    side2: { label: "Gold", score: 2 },
  });

  assert.equal(result.momentText, "Gold beat Blue 2-0.");
  assert.equal(result.headline, "Gold take the win in Sunday Final");
  assert.match(result.body, /Blue scored 0, while Gold scored 2/);
});

test("immersive fallback reports a draw without inventing match events", () => {
  const result = buildFallbackImmersiveNews({
    name: "Sunday Final",
    side1: { label: "Blue", score: 2 },
    side2: { label: "Gold", score: 2 },
  });

  assert.equal(result.momentTitle, "Sunday Final ends level");
  assert.equal(result.momentText, "Blue and Gold finished level at 2-2.");
  assert.equal(result.headline, "Blue and Gold share the result");
  assert.equal(result.generatedBy, "fallback");
  assert.equal(result.icon, "🤝");
  assert.doesNotMatch(JSON.stringify(result), /goal scorer|comeback|injury|tactic/i);
});

test("immersive fallback sanitizes missing labels and invalid scores", () => {
  const result = buildFallbackImmersiveNews({
    side1: { label: " ", score: Number.NaN },
    side2: { label: "", score: -1 },
  });

  assert.equal(result.momentText, "Team A and Team B finished level at 0-0.");
  assert.equal(result.generatedBy, "fallback");
});

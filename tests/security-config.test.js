import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedCorsOrigin } from "../server/config/corsPolicy.js";

test("production CORS allowlists only the canonical frontend origin", () => {
  assert.equal(isAllowedCorsOrigin("https://gg-matchday.vercel.app", "production"), true);
  assert.equal(isAllowedCorsOrigin("http://localhost:5173", "production"), false);
  assert.equal(isAllowedCorsOrigin("https://untrusted.example", "production"), false);
  assert.equal(isAllowedCorsOrigin(undefined, "production"), true);
});

test("development CORS explicitly permits supported local frontend origins", () => {
  assert.equal(isAllowedCorsOrigin("http://localhost:5173", "development"), true);
  assert.equal(isAllowedCorsOrigin("http://127.0.0.1:4173", "development"), true);
  assert.equal(isAllowedCorsOrigin("https://untrusted.example", "development"), false);
});

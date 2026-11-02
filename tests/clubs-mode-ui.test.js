import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Clubs mode keeps formation controls, discovery and admin surfaces while using task navigation", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /Ultimate Clubs/);
  assert.match(component, /Player History/);
  assert.match(component, /data-primary-tab="overview"/);
  assert.match(component, /data-primary-tab="myClub"/);
  assert.doesNotMatch(component, /aria-label="Ultimate Clubs sections"/);
  assert.doesNotMatch(component, /aria-label="My Club sections"/);
  assert.match(component, /clubs-subnav/);
  assert.match(component, /clubs-hub-discovery-grid/);
  assert.match(component, /clubs-formation-stepper/);
  assert.match(component, /clubs-scout-card/);
  assert.match(component, /clubs-review-received/);
  assert.match(component, /NEEDS ATTENTION/);
  assert.match(component, /clubs-history-summary-grid/);
  assert.match(component, /clubs-admin-club-card/);
  for (const formation of ["1-2-1", "2-1-1", "1-3", "3-1", "2-2", "1-2-2", "2-2-1", "2-1-2", "1-3-1", "3-1-1"]) {
    assert.match(component, new RegExp(formation));
  }
  assert.match(styles, /clubs-command-grid/);
  assert.match(styles, /clubs-pitch/);
  assert.match(styles, /clubs-field-card/);
  assert.match(styles, /data-theme="golden"/);
  assert.match(styles, /\.clubs-su¶»§q«^
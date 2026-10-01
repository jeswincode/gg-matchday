import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { inferClubSides, winnerForClub } from "../server/services/clubsMatchSync.js";

const ids = { clubA: "aaaaaaaaaaaaaaaaaaaaaaaa", clubB: "bbbbbbbbbbbbbbbbbbbbbbbb", p1: "111111111111111111111111", p2: "222222222222222222222222", p3: "333333333333333333333333", p4: "444444444444444444444444" };
const oid = value => ({ _id: value });
const contract = clubId => ({ clubId });

test("side inference maps Match sides to the two scheduled clubs", () => {
  const mainMatch = { participants: [{ player: oid(ids.p1), team: "A" }, { player: oid(ids.p2), team: "A" }, { player: oid(ids.p3), team: "B" }, { player: oid(ids.p4), team: "B" }] };
  const contracts = new Map([[ids.p1, contract(ids.clubA)], [ids.p2, contract(ids.clubA)], [ids.p3, contract(ids.clubB)], [ids.p4, contract(ids.clubB)]]);
  assert.deepEqual(inferClubSides(mainMatch, contracts, { clubAId: ids.clubA, clubBId: ids.clubB }), { clubAIsSideA: true });
});

test("side inference handles reversed Match sides", () => {
  const mainMatch = {
    participants: [
      { player: oid(ids.p1), team: "A" },
      { player: oid(ids.p2), team: "A" },
      { player: oid(ids.p3), team: "B" },
      { player: oid(ids.p4), team: "B" },
    ],
  };
  const contracts = new Map([
    [ids.p1, contract(ids.clubB)],
    [ids.p2, contract(ids.clubB)],
    [ids.p3, contract(ids.clubA)],
    [ids.p4, contract(ids.clubA)],
  ]);
  assert.deepEqual(
    inferClubSides(mainMatch, contracts, { clubAId: ids.clubA, clubBId: ids.clubB }),
    { clubAIsSideA: false },
  );
});

test("side inference rejects mixed-club and non-club participants", () => {
  const mainMatch = { participants: [{ player: oid(ids.p1), team: "A" }, { player: oid(ids.p2), team: "A" }, { player: oid(ids.p3), team: "B" }, { player: oid(ids.p4), team: "B" }] };
  const contracts = new Map([[ids.p1, contract(ids.clubA)], [ids.p2, contract(ids.clubB)], [ids.p3, contract(ids.clubB)], [ids.p4, contract(ids.clubB)]]);
  assert.equal(inferClubSides(mainMatch, contracts, { clubAId: ids.clubA, clubBId: ids.clubB }), null);
  contracts.delete(ids.p4);
  assert.equal(inferClubSides(mainMatch, contracts, { clubAId: ids.clubA, clubBId: ids.clubB }), null);
});

test("winner mapping follows the club side", () => {
  assert.equal(winnerForClub(3, 1, true), "win");
  assert.equal(winnerForClub(3, 1, false), "loss");
  assert.equal(winnerForClub(1, 3, false), "win");
  assert.equal(winnerForClub(2, 2, true), "draw");
});

test("match sync reconciles already-linked Match edits", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("server/services/clubsMatchSync.js", "utf8");
  assert.match(source, /mainMatchId: mainMatch\._id, status: "completed"/);
  assert.match(source, /status: "accepted", mainMatchId: null/);
});

test("stats sync writes the schema field named matches", async () => {
  const fs = await import("node:fs/promises");
  const modelSource = await fs.readFile("server/models/clubs/ClubPlayerStats.js", "utf8");
  const syncSource = await fs.readFile("server/services/clubsMatchSync.js", "utf8");
  assert.match(modelSource, /\bmatches:\s*\{/);
  assert.match(syncSource, /matches:\s*matchesPlayed/);
});

test("Clubs mode exposes a functional Matches panel", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/features/clubs/ClubsMode.jsx", "utf8");
  assert.match(source, /activeSection === "matches"/);
  assert.match(source, /\/clubs\/matches/);
  assert.match(source, /Request Club Match/);
});

test("Clubs mode exposes functional My Club stats and history", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/features/clubs/ClubsMode.jsx", "utf8");
  assert.match(source, /activeSection === "myClub"/);
  assert.match(source, /\/clubs\/" \+ currentClub\._id \+ "\/stats/);
  assert.match(source, /\/clubs\/" \+ currentClub\._id \+ "\/history/);
  assert.match(source, /PERMANENT HISTORY/);
  assert.match(source, /Club player/);
});


test("Clubs UI exposes player reviews navigation and submission form", () => {
  const source = readFileSync(new URL("../src/features/clubs/ClubsMode.jsx", import.meta.url), "utf8");
  assert.match(source, /activeSection === "reviews"/);
  assert.match(source, /reviews\/eligible\/me/);
  assert.match(source, /Submit review/);
  assert.match(source, /teammate/);
  assert.match(source, /opponent/);
});


test("side inference requires a supported 2v2, 3v3 or 4v4 Club Match size", () => {
  const mainMatch = {
    participants: [
      { player: oid(ids.p1), team: "A" },
      { player: oid(ids.p2), team: "B" },
    ],
  };
  const contracts = new Map([
    [ids.p1, contract(ids.clubA)],
    [ids.p2, contract(ids.clubB)],
  ]);
  assert.equal(
    inferClubSides(mainMatch, contracts, { clubAId: ids.clubA, clubBId: ids.clubB }),
    null,
  );
});

test("side inference accepts a valid 2v2 Club Match", () => {
  const mainMatch = {
    participants: [
      { player: oid(ids.p1), team: "A" },
      { player: oid(ids.p2), team: "A" },
      { player: oid(ids.p3), team: "B" },
      { player: oid(ids.p4), team: "B" },
    ],
  };
  const contracts = new Map([
    [ids.p1, contract(ids.clubA)],
    [ids.p2, contract(ids.clubA)],
    [ids.p3, contract(ids.clubB)],
    [ids.p4, contract(ids.clubB)],
  ]);
  assert.deepEqual(
    inferClubSides(mainMatch, contracts, { clubAId: ids.clubA, clubBId: ids.clubB }),
    { clubAIsSideA: true },
  );
});

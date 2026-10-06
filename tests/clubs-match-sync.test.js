import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import {
  inferClubSides,
  winnerForClub,
  isClubsMatchName,
  matchClubNames,
} from "../server/services/clubsMatchSync.js";

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
  const source = await readFile("server/services/clubsMatchSync.js", "utf8");
  assert.match(source, /mainMatchId: mainMatch\._id, status: "completed"/);
  assert.match(source, /status: "accepted", mainMatchId: null/);
});

test("stats sync writes the schema field named matches", async () => {
  const modelSource = await readFile("server/models/clubs/ClubPlayerStats.js", "utf8");
  const syncSource = await readFile("server/services/clubsMatchSync.js", "utf8");
  assert.match(modelSource, /\bmatches:\s*\{/);
  assert.match(syncSource, /matches:\s*matchesPlayed/);
});

test("Clubs mode exposes a functional Matches panel", async () => {
  const source = await readFile("src/features/clubs/ClubsMode.jsx", "utf8");
  assert.match(source, /activeSection === "overview" && ultimateSubsection === "matches"/);
  assert.match(source, /\/clubs\/matches/);
  assert.match(source, /Request Club Match/);
});

test("Club renewal frontend paths match the mounted Clubs router", async () => {
  const [routeSource, uiSource] = await Promise.all([
    readFile("server/routes/clubs.js", "utf8"),
    readFile("src/features/clubs/ClubsMode.jsx", "utf8"),
  ]);
  assert.match(routeSource, /router\.get\("\/:clubId\/renewal"/);
  assert.match(routeSource, /router\.post\("\/:clubId\/renewal"/);
  assert.match(uiSource, /\/clubs\/" \+ currentClub\._id \+ "\/renewal/);
  assert.doesNotMatch(routeSource, /router\.(?:get|post)\("\/clubs\/:clubId\/renewal"/);
});

test("Club prediction mirrors head-to-head probability between both clubs", async () => {
  const source = await readFile("server/services/clubsPrediction.js", "utf8");
  assert.match(source, /\{ \.\.\.a, headToHead: h2hA \}/);
  assert.match(source, /\{ \.\.\.b, headToHead: 1 - h2hA \}/);
});

test("Clubs mode exposes functional My Club stats and history", async () => {
  const source = await readFile("src/features/clubs/ClubsMode.jsx", "utf8");
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


test("side inference accepts a valid 5v5 Club Match", () => {
  const mainMatch = {
    participants: [
      { player: oid(ids.p1), team: "A" },
      { player: oid(ids.p2), team: "A" },
      { player: oid(ids.p3), team: "A" },
      { player: oid(ids.p4), team: "A" },
      { player: oid("555555555555555555555555"), team: "A" },
      { player: oid("666666666666666666666666"), team: "B" },
      { player: oid("777777777777777777777777"), team: "B" },
      { player: oid("888888888888888888888888"), team: "B" },
      { player: oid("999999999999999999999999"), team: "B" },
      { player: oid("aaaaaaaaaaaaaaaaaaaaaaaa"), team: "B" },
    ],
  };
  const contracts = new Map([
    [ids.p1, contract(ids.clubA)],
    [ids.p2, contract(ids.clubA)],
    [ids.p3, contract(ids.clubA)],
    [ids.p4, contract(ids.clubA)],
    ["555555555555555555555555", contract(ids.clubA)],
    ["666666666666666666666666", contract(ids.clubB)],
    ["777777777777777777777777", contract(ids.clubB)],
    ["888888888888888888888888", contract(ids.clubB)],
    ["999999999999999999999999", contract(ids.clubB)],
    ["aaaaaaaaaaaaaaaaaaaaaaaa", contract(ids.clubB)],
  ]);
  assert.deepEqual(
    inferClubSides(mainMatch, contracts, { clubAId: ids.clubA, clubBId: ids.clubB }),
    { clubAIsSideA: true },
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

test("Matchday protects linked Club fixtures from deletion while allowing pre-settlement edits", async () => {
  const source = await readFile("server/routes/matches.js", "utf8");
  assert.match(source, /hasLinkedClubMatch\(previous\._id, \{ settledOnly: true \}\)/);
  assert.match(source, /hasLinkedClubMatch\(req\.params\.id\)/);
  assert.match(source, /This Match Record cannot be deleted because it has a linked Club Match/);
});


test("hardening paths are present for Clubs concurrency and durable synchronization", async () => {
  const [routeSource, matchSource, auctionSource, joinSource, workflowSource, syncSource, modelSource] = await Promise.all([
    readFile("server/routes/clubs.js", "utf8"),
    readFile("server/models/clubs/ClubMatch.js", "utf8"),
    readFile("server/models/clubs/AuctionOffer.js", "utf8"),
    readFile("server/models/clubs/JoinRequest.js", "utf8"),
    readFile(".github/workflows/validate.yml", "utf8"),
    readFile("server/services/clubsSync.js", "utf8"),
    readFile("server/models/ClubSyncJob.js", "utf8"),
  ]);

  assert.match(routeSource, /withTransaction\(/);
  assert.match(routeSource, /prediction\/refresh/);
  assert.match(routeSource, /return res\.json\(match\.prediction \|\| null\)/);
  assert.match(matchSource, /optimisticConcurrency: true/);
  assert.match(auctionSource, /partialFilterExpression/);
  assert.match(joinSource, /partialFilterExpression/);
  assert.match(syncSource, /retryPendingClubSyncJobs/);
  assert.match(syncSource, /clubSyncBackoffMs/);
  assert.match(modelSource, /getClubsConnection\(\)\.model/);
  assert.match(workflowSource, /GG-Matchday-v3/);
});

test("Matchday match mutations fail closed when configured Clubs storage is unavailable", async () => {
  const source = await readFile("server/routes/matches.js", "utf8");
  assert.match(source, /ensureClubsMutationSafety/);
  assert.match(source, /Clubs data is temporarily unavailable/);
  assert.match(source, /enqueueClubSyncJob/);
});


test("Clubs marker is normalized like the existing El Clásico classifier", () => {
  assert.equal(isClubsMatchName("Clubs"), true);
  assert.equal(isClubsMatchName("GG CLUBS Match"), true);
  assert.equal(isClubsMatchName("Sunday Football"), false);
});

test("Club name matching is exact after normalization and accepts reversed sides", () => {
  const clubs = new Map([
    ["aaaaaaaaaaaaaaaaaaaaaaaa", { _id: ids.clubA, name: "Golden Gooners" }],
    ["bbbbbbbbbbbbbbbbbbbbbbbb", { _id: ids.clubB, name: "Test FC" }],
  ]);
  assert.deepEqual(
    matchClubNames(
      { teamA: { label: " Golden   Gooners " }, teamB: { label: "Test FC" } },
      { clubAId: ids.clubA, clubBId: ids.clubB },
      clubs,
    ),
    { clubAIsSideA: true },
  );
  assert.deepEqual(
    matchClubNames(
      { teamA: { label: "Test FC" }, teamB: { label: "Golden Gooners" } },
      { clubAId: ids.clubA, clubBId: ids.clubB },
      clubs,
    ),
    { clubAIsSideA: false },
  );
  assert.equal(
    matchClubNames(
      { teamA: { label: "Golden Gooners FC" }, teamB: { label: "Test FC" } },
      { clubAId: ids.clubA, clubBId: ids.clubB },
      clubs,
    ),
    null,
  );
});

test("Club Match model distinguishes booked and unbooked sources", async () => {
  const source = await readFile("server/models/clubs/ClubMatch.js", "utf8");
  assert.match(source, /source: \{ type: String, enum: \["booked", "unbooked"\]/);
  assert.match(source, /fixtureDate:/);
  assert.match(source, /unique: true/);
});

test("Club Match booking UI uses date-only input", async () => {
  const source = await readFile("src/features/clubs/ClubsMode.jsx", "utf8");
  assert.match(source, /type="date"/);
  assert.match(source, /fixtureDate: matchScheduledAt/);
  assert.doesNotMatch(source, /type="datetime-local"/);
});

test("Club sync requires the Clubs marker before any Club Match classification", async () => {
  const source = await readFile("server/services/clubsMatchSync.js", "utf8");
  assert.match(source, /if \(!mainMatch\?\._id \|\| !isClubsMatchName\(mainMatch\.name\)\)/);
  assert.match(source, /participant-club-membership-mismatch/);
});

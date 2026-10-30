import test from "node:test";
import assert from "node:assert/strict";
import { getClubFacilityProgress, summarizeClubRecord } from "../src/features/clubs/club-progression.js";

test("Club record calculates wins and losses from the current Club's actual side", () => {
  const clubId = "club-a";
  const record = summarizeClubRecord(clubId, [
    { clubAId: clubId, clubBId: "club-b", clubAScore: 3, clubBScore: 1 },
    { clubAId: "club-c", clubBId: clubId, clubAScore: 0, clubBScore: 2 },
    { clubAId: clubId, clubBId: "club-d", clubAScore: 1, clubBScore: 1 },
    { clubAId: "club-e", clubBId: clubId, clubAScore: 4, clubBScore: 2 },
  ]);
  assert.deepEqual(record, { wins: 2, draws: 1, losses: 1, unavailable: 0 });
});

test("Club record refuses to invent results without scores or a matching Club ID", () => {
  const record = summarizeClubRecord("club-a", [
    { clubAId: "club-a", clubBId: "club-b", clubAScore: null, clubBScore: 1 },
    { clubAId: "club-x", clubBId: "club-y", clubAScore: 3, clubBScore: 0 },
  ]);
  assert.equal(record.unavailable, 2);
  assert.equal(record.wins + record.draws + record.losses, 0);
});

test("stadium facilities progress through completed fixture tiers", () => {
  assert.equal(getClubFacilityProgress({ fixtures: 0 }).ground.level, 1);
  assert.equal(getClubFacilityProgress({ fixtures: 5 }).ground.level, 2);
  assert.equal(getClubFacilityProgress({ fixtures: 15 }).ground.level, 3);
  assert.equal(getClubFacilityProgress({ fixtures: 30 }).ground.level, 4);
});

test("training and academy facility tiers use only supplied OVR and roster evidence", () => {
  assert.equal(getClubFacilityProgress({ teamOvr: null }).training.level, 1);
  assert.equal(getClubFacilityProgress({ teamOvr: 65 }).training.level, 2);
  assert.equal(getClubFacilityProgress({ teamOvr: 75 }).training.level, 3);
  assert.equal(getClubFacilityProgress({ teamOvr: 85 }).training.level, 4);
  assert.equal(getClubFacilityProgress({ memberCount: 4 }).academy.level, 2);
  assert.equal(getClubFacilityProgress({ memberCount: 5 }).academy.level, 3);
});

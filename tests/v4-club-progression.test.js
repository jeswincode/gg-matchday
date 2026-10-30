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

test("Training Centre progresses from completed Club team sessions rather than OVR", () => {
  assert.equal(getClubFacilityProgress({ completedTrainingSessions: 0, teamOvr: 99 }).training.level, 1);
  assert.equal(getClubFacilityProgress({ completedTrainingSessions: 3, teamOvr: 10 }).training.level, 2);
  assert.equal(getClubFacilityProgress({ completedTrainingSessions: 10, teamOvr: null }).training.level, 3);
  assert.equal(getClubFacilityProgress({ completedTrainingSessions: 25, teamOvr: 1 }).training.level, 4);
  assert.equal(getClubFacilityProgress({ completedTrainingSessions: 2 }).trainingProgress, 67);
  assert.equal(getClubFacilityProgress({ completedTrainingSessions: 6 }).trainingProgress, 43);
  assert.equal(getClubFacilityProgress({ completedTrainingSessions: 17 }).trainingProgress, 47);
  assert.equal(getClubFacilityProgress({ memberCount: 4 }).academy.level, 2);
  assert.equal(getClubFacilityProgress({ memberCount: 5 }).academy.level, 3);
});

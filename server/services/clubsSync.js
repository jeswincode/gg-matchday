import Match from "../models/Match.js";
import ClubSyncJob from "../models/ClubSyncJob.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import { syncClubStatsForMatch } from "./clubsMatchSync.js";
import { settleClubMatchRewards } from "./clubsMatchSettlement.js";
import { settleClubMatchBets } from "./clubsBetting.js";

export const CLUB_SYNC_RETRY_BASE_MS = 30_000;
export const CLUB_SYNC_RETRY_MAX_MS = 60 * 60_000;
export const CLUB_SYNC_LOCK_MS = 2 * 60_000;

export function clubsIntegrationConfigured() {
  return Boolean(String(process.env.CLUBS_MONGODB_URI || "").trim());
}

export function clubSyncBackoffMs(attempts) {
  const exponent = Math.max(0, Math.min(8, Number(attempts || 1) - 1));
  return Math.min(CLUB_SYNC_RETRY_MAX_MS, CLUB_SYNC_RETRY_BASE_MS * (2 ** exponent));
}

async function settleLinkedClubMatches(syncResult) {
  for (const clubMatchId of syncResult?.clubMatchIds || []) {
    const session = await getClubsConnection().startSession();
    try {
      await session.withTransaction(async () => {
        await settleClubMatchRewards({ clubMatchId, session });
        await settleClubMatchBets({ clubMatchId, session });
      });
    } finally {
      await session.endSession();
    }
  }
}

export async function syncMainMatchToClubs(mainMatch) {
  if (!clubsIntegrationConfigured()) return { linked: false, clubMatchIds: [], affectedClubIds: [] };
  const result = await syncClubStatsForMatch(mainMatch);
  await settleLinkedClubMatches(result);
  return result;
}

export async function enqueueClubSyncJob(mainMatchId, lastError = "") {
  if (!clubsIntegrationConfigured() || !mainMatchId) return null;
  return ClubSyncJob.findOneAndUpdate(
    { mainMatchId },
    {
      $set: {
        status: "pending",
        nextAttemptAt: new Date(),
        lockedUntil: null,
        lastError: String(lastError || "").slice(0, 1000),
        completedAt: null,
      },
      $setOnInsert: { mainMatchId, attempts: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function completeClubSyncJob(mainMatchId) {
  await ClubSyncJob.updateOne(
    { mainMatchId },
    { $set: { status: "completed", lockedUntil: null, lastError: "", completedAt: new Date() } },
  );
}

async function claimClubSyncJob(job) {
  const now = new Date();
  return ClubSyncJob.findOneAndUpdate(
    {
      _id: job._id,
      $or: [
        { status: "pending", nextAttemptAt: { $lte: now } },
        { status: "processing", lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: { status: "processing", lockedUntil: new Date(now.getTime() + CLUB_SYNC_LOCK_MS) },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
}

export async function processClubSyncJob(job) {
  if (!clubsIntegrationConfigured()) return { skipped: true };
  const claimed = await claimClubSyncJob(job);
  if (!claimed) return { claimed: false };

  try {
    const mainMatch = await Match.findById(claimed.mainMatchId).lean();
    if (!mainMatch) {
      await completeClubSyncJob(claimed.mainMatchId);
      return { completed: true, missingMatch: true };
    }
    const result = await syncMainMatchToClubs(mainMatch);
    await completeClubSyncJob(claimed.mainMatchId);
    return { completed: true, result };
  } catch (error) {
    await ClubSyncJob.updateOne(
      { _id: claimed._id, status: "processing" },
      {
        $set: {
          status: "pending",
          lockedUntil: null,
          nextAttemptAt: new Date(Date.now() + clubSyncBackoffMs(claimed.attempts)),
          lastError: String(error?.message || error || "Unknown Clubs sync failure").slice(0, 1000),
        },
      },
    );
    console.error("Clubs sync job failed:", claimed.mainMatchId, error?.message || error);
    return { completed: false, error: error?.message || String(error) };
  }
}

export async function retryPendingClubSyncJobs({ limit = 10 } = {}) {
  if (!clubsIntegrationConfigured()) return { attempted: 0, completed: 0 };
  const now = new Date();
  const jobs = await ClubSyncJob.find({
    $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "processing", lockedUntil: { $lte: now } },
    ],
  }).sort({ nextAttemptAt: 1, createdAt: 1 }).limit(limit).lean();

  let completed = 0;
  for (const job of jobs) {
    const result = await processClubSyncJob(job);
    if (result.completed) completed += 1;
  }
  return { attempted: jobs.length, completed };
}

export function startClubSyncWorker(intervalMs = CLUB_SYNC_RETRY_BASE_MS) {
  if (!clubsIntegrationConfigured()) return () => {};
  const run = () => retryPendingClubSyncJobs().catch(error => console.error("Clubs sync worker failed:", error));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

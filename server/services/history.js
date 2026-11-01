import Player from "../models/Player.js";
import Match from "../models/Match.js";
import Award from "../models/Award.js";
import Achievement from "../models/Achievement.js";
import { buildStatistics, milestoneRules, selectAwards, calendarParts, MATCHDAY_TIME_ZONE, nextCalendarMonthBoundary } from "./statistics.js";

let pending;
let boundaryTimer;
const RETRY_DELAY_MS = 5 * 60 * 1000;

export function syncHistory(now = new Date()) {
  if (pending) return pending.then(() => syncHistory(now));
  pending = (async () => {
    const [players, matches] = await Promise.all([Player.find().lean(), Match.find().lean()]);
    const ops = [];
    for (const stats of buildStatistics(players, matches)) {
      for (const [key, levels] of Object.entries(milestoneRules)) {
        for (const threshold of levels) {
          if (stats[key] >= threshold) {
            ops.push({
              updateOne: {
                filter: { player: stats.playerId, key: `${key}:${threshold}` },
                update: { $setOnInsert: { player: stats.playerId, key: `${key}:${threshold}`, label: `${threshold} ${key === "cleanSheets" ? "clean sheets" : key}` } },
                upsert: true,
              },
            });
          }
        }
      }
    }
    if (ops.length) await Achievement.bulkWrite(ops, { ordered: false });

    const current = calendarParts(now);
    const periods = new Map();

    // Only completed IST calendar months are finalized. Current-month awards
    // remain provisional and are never deleted or overwritten by this worker.
    for (const match of matches) {
      const period = calendarParts(match.date);
      if (period.year < current.year) {
        periods.set(`year:${period.year}`, { year: period.year });
      }
      if (period.year < current.year || (period.year === current.year && period.month < current.month)) {
        periods.set(`month:${period.year}:${period.month}`, { year: period.year, month: period.month });
      }
    }

    for (const period of periods.values()) {
      for (const award of selectAwards(players, matches, period)) {
        const key = `${award.type}:${award.year}:${award.month || 0}`;
        await Award.updateOne(
          { key },
          { $setOnInsert: { ...award, key } },
          { upsert: true },
        );
      }
    }
    return { achievements: ops.length, finalizedPeriods: periods.size, timeZone: MATCHDAY_TIME_ZONE };
  })().finally(() => { pending = null; });
  return pending;
}

async function executeBoundary(run) {
  try {
    await run(new Date());
    armNextBoundary(new Date(), run);
  } catch (error) {
    console.error("Monthly award finalization failed; retrying:", error.message);
    boundaryTimer = setTimeout(() => executeBoundary(run), RETRY_DELAY_MS);
    boundaryTimer.unref?.();
  }
}

function armNextBoundary(now = new Date(), run = syncHistory) {
  if (boundaryTimer) clearTimeout(boundaryTimer);
  const boundary = nextCalendarMonthBoundary(now);
  // Node timers are capped at ~24.8 days. Wake at most daily while the
  // boundary is distant, then arm the final timeout for the exact IST midnight.
  const remaining = Math.max(0, boundary.getTime() - now.getTime());
  const delay = Math.min(remaining, 24 * 60 * 60 * 1000);
  boundaryTimer = setTimeout(() => {
    const current = new Date();
    if (current.getTime() < boundary.getTime()) {
      armNextBoundary(current, run);
      return;
    }
    void executeBoundary(run);
  }, delay);
  boundaryTimer.unref?.();
}

export function startHistoryScheduler({ run = syncHistory, now = () => new Date() } = {}) {
  // Startup catch-up covers downtime/redeployments across a month boundary.
  Promise.resolve(run(now())).catch(error => {
    console.error("Historical recognition startup catch-up failed:", error.message);
  });
  armNextBoundary(now(), run);
  return () => {
    if (boundaryTimer) clearTimeout(boundaryTimer);
    boundaryTimer = null;
  };
}

export function scheduleHistory() {
  return syncHistory().catch(error => {
    console.error("Historical recognition could not be refreshed:", error.message);
    throw error;
  });
}

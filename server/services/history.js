import Player from "../models/Player.js";
import Match from "../models/Match.js";
import Award from "../models/Award.js";
import Achievement from "../models/Achievement.js";
import { buildStatistics, milestoneRules, selectAwards } from "./statistics.js";
import { currentWorldDataScope, runWithWorldDataScope } from "./worldDataScope.js";

const pendingByWorld = new Map();
const worldKey = worldId => worldId == null ? "legacy" : String(worldId);

async function syncHistoryForWorld(worldId) {
  return runWithWorldDataScope(worldId || null, async () => {
    const [players, matches] = await Promise.all([
      Player.find({ worldId: worldId || null }).lean(),
      Match.find({ worldId: worldId || null }).lean(),
    ]);

    const operations = [];
    for (const stats of buildStatistics(players, matches)) {
      for (const [key, levels] of Object.entries(milestoneRules)) {
        for (const threshold of levels) {
          if (stats[key] < threshold) continue;
          const achievementKey = key + ":" + threshold;
          operations.push({
            updateOne: {
              filter: {
                worldId: worldId || null,
                player: stats.playerId,
                key: achievementKey,
              },
              update: {
                $setOnInsert: {
                  worldId: worldId || null,
                  player: stats.playerId,
                  key: achievementKey,
                  label: threshold + " " + (key === "cleanSheets" ? "clean sheets" : key),
                },
              },
              upsert: true,
            },
          });
        }
      }
    }
    if (operations.length) await Achievement.bulkWrite(operations, { ordered: false });

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const periods = new Map();

    // Current-month awards remain provisional until the calendar month ends.
    await Award.deleteMany({
      worldId: worldId || null,
      year: currentYear,
      month: currentMonth,
      type: { $in: ["player", "offensive", "defensive"] },
    });

    for (const match of matches) {
      const date = new Date(match.date);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      if (year < currentYear) periods.set(String(year), { year });
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        periods.set(year + "-" + month, { year, month });
      }
    }

    for (const period of periods.values()) {
      for (const award of selectAwards(players, matches, period)) {
        const key = award.type + ":" + award.year + ":" + (award.month || 0);
        await Award.updateOne(
          { worldId: worldId || null, key },
          {
            $setOnInsert: {
              ...award,
              worldId: worldId || null,
              key,
            },
          },
          { upsert: true },
        );
      }
    }

    return { worldId: worldId || null, players: players.length, matches: matches.length };
  });
}

function runOnce(worldId) {
  const key = worldKey(worldId);
  if (pendingByWorld.has(key)) return pendingByWorld.get(key);

  const task = syncHistoryForWorld(worldId)
    .finally(() => pendingByWorld.delete(key));
  pendingByWorld.set(key, task);
  return task;
}

export async function syncHistory() {
  const activeScope = currentWorldDataScope();
  if (activeScope) return runOnce(activeScope.worldId || null);

  const worldIds = await Player.distinct("worldId", {});
  const scopes = worldIds.length ? worldIds : [null];
  return Promise.all(scopes.map(worldId => runOnce(worldId || null)));
}

export function scheduleHistory() {
  syncHistory().catch(() => console.error("Historical recognition could not be refreshed."));
}

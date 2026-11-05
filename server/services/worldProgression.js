import WorldEconomy from "../models/clubs/WorldEconomy.js";
import WorldEconomyLedger from "../models/clubs/WorldEconomyLedger.js";
import WorldDailyProgress from "../models/clubs/WorldDailyProgress.js";
import WorldRewardClaim from "../models/clubs/WorldRewardClaim.js";
import WorldAchievement from "../models/clubs/WorldAchievement.js";
import { WORLD_ACHIEVEMENTS, WORLD_ECONOMY_RULES, levelProgress, utcDayKey } from "../config/worldProgression.js";

export async function grantWorldReward({
  playerId, sourceKey, sourceType, xp = 0, coins = 0, metadata = {}, session, now = new Date(),
}) {
  if (!session) throw new TypeError("World rewards must be granted inside a database transaction.");
  const normalizedKey = String(sourceKey || "").trim();
  if (!normalizedKey || normalizedKey.length > 120) throw new TypeError("A valid reward source key is required.");

  const prior = await WorldRewardClaim.findOne({ playerId, sourceKey: normalizedKey }).session(session).lean();
  if (prior) return { duplicate: true, claim: prior, economy: await WorldEconomy.findOne({ playerId }).session(session).lean(), levelUps: 0 };

  const dayKey = utcDayKey(now);
  const daily = await WorldDailyProgress.findOneAndUpdate(
    { playerId, dayKey },
    { $setOnInsert: { playerId, dayKey } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session },
  ).lean();

  let requestedXp = Math.max(0, Math.min(500, Math.floor(Number(xp) || 0)));
  let requestedCoins = Math.max(0, Math.min(500, Math.floor(Number(coins) || 0)));
  if (sourceType === "training-session") {
    requestedXp = Math.min(requestedXp, Math.max(0, WORLD_ECONOMY_RULES.dailyTrainingXpCap - daily.trainingXpEarned));
    requestedCoins = Math.min(requestedCoins, Math.max(0, WORLD_ECONOMY_RULES.dailyTrainingCoinCap - daily.trainingCoinsEarned));
  }
  const grantedXp = Math.min(requestedXp, Math.max(0, WORLD_ECONOMY_RULES.dailyXpCap - daily.xpEarned));
  const grantedCoins = Math.min(requestedCoins, Math.max(0, WORLD_ECONOMY_RULES.dailyCoinCap - daily.coinsEarned));

  const walletBefore = await WorldEconomy.findOneAndUpdate(
    { playerId },
    { $setOnInsert: { playerId, coins: 0, xp: 0, level: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session },
  ).lean();
  const previousLevel = levelProgress(walletBefore.xp || 0).level;
  const newXp = (walletBefore.xp || 0) + grantedXp;
  const progression = levelProgress(newXp);
  const levelUps = Math.max(0, progression.level - previousLevel);
  // Level-up coins are a capped milestone bonus and pass through the same daily coin limit.
  const levelBonusRequested = Math.min(75, levelUps * 15);
  const finalCoins = Math.min(
    grantedCoins + levelBonusRequested,
    Math.max(0, WORLD_ECONOMY_RULES.dailyCoinCap - daily.coinsEarned),
  );

  const wallet = await WorldEconomy.findOneAndUpdate(
    { playerId },
    { $inc: { xp: grantedXp, coins: finalCoins, lifetimeXpEarned: grantedXp, lifetimeCoinsEarned: finalCoins },
      $set: { level: progression.level, xpIntoLevel: progression.xpIntoLevel, xpForNextLevel: progression.xpForNextLevel } },
    { new: true, session, runValidators: true },
  ).lean();

  const dailyUpdate = {
    xpEarned: grantedXp,
    coinsEarned: finalCoins,
    ...(sourceType === "training-session" ? { trainingXpEarned: grantedXp, trainingCoinsEarned: finalCoins, trainingSessions: 1 } : {}),
    ...(sourceType === "tutorial" ? { tutorialClaims: 1 } : {}),
  };
  await WorldDailyProgress.updateOne({ playerId, dayKey }, { $inc: dailyUpdate }, { session });

  const [claim] = await WorldRewardClaim.create([{
    playerId, sourceKey: normalizedKey, sourceType, xpGranted: grantedXp, coinsGranted: finalCoins, dayKey, metadata,
  }], { session });
  const [ledger] = await WorldEconomyLedger.create([{
    playerId, idempotencyKey: "reward:" + normalizedKey, type: "reward",
    coinsDelta: finalCoins, xpDelta: grantedXp, balanceAfter: wallet.coins, xpAfter: wallet.xp,
    metadata: { sourceType, sourceKey: normalizedKey, levelUps, ...metadata },
  }], { session });

  return { duplicate: false, claim: claim.toObject(), ledger: ledger.toObject(), economy: wallet, progression, levelUps };
}

export async function unlockTrainingAchievements(playerId, trainingProfile, session) {
  const unlocked = [];
  for (const achievement of WORLD_ACHIEVEMENTS) {
    if (!achievement.test(trainingProfile)) continue;
    const existing = await WorldAchievement.findOne({ playerId, achievementId: achievement.id }).session(session).lean();
    if (existing) continue;
    const [record] = await WorldAchievement.create([{
      playerId, achievementId: achievement.id, xpReward: achievement.xp, coinReward: achievement.coins,
    }], { session });
    const reward = await grantWorldReward({
      playerId,
      sourceKey: "achievement:" + achievement.id,
      sourceType: "achievement",
      xp: achievement.xp,
      coins: achievement.coins,
      metadata: { achievementId: achievement.id, achievementName: achievement.name },
      session,
    });
    unlocked.push({ ...record.toObject(), name: achievement.name, description: achievement.description, reward });
  }
  return unlocked;
}

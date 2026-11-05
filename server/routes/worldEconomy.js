import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import WorldEconomy from "../models/clubs/WorldEconomy.js";
import WorldEconomyLedger from "../models/clubs/WorldEconomyLedger.js";
import WorldInventoryItem from "../models/clubs/WorldInventoryItem.js";
import PlayerAvatar from "../models/clubs/PlayerAvatar.js";
import PlayerResidence from "../models/clubs/PlayerResidence.js";
import WorldDailyProgress from "../models/clubs/WorldDailyProgress.js";
import WorldAchievement from "../models/clubs/WorldAchievement.js";
import { WORLD_ACHIEVEMENTS, WORLD_ECONOMY_RULES, utcDayKey } from "../config/worldProgression.js";
import { levelProgress } from "../config/worldProgression.js";

const router = express.Router();
router.use(requireAuth);

const CATALOG = Object.freeze([
  { id: "boots-gold", name: "Golden Boots", category: "boots", price: 120, minLevel: 2, description: "A bright pair of matchday boots.", rarity: "rare" },
  { id: "kit-neon", name: "Neon Training Kit", category: "kit", price: 180, minLevel: 3, description: "A vivid training look.", rarity: "rare" },
  { id: "hair-silver", name: "Silver Hair", category: "hair", price: 90, minLevel: 1, description: "A cool silver hairstyle colour.", rarity: "common" },
]);

function playerIdFor(req, res) {
  const id = req.user?.playerProfile;
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(403).json({ message: "Link your GG player profile to use the Original GG economy." });
    return null;
  }
  return id;
}

function publicItem(item) {
  return { id: item.id, name: item.name, category: item.category, price: item.price, minLevel: item.minLevel || 1, description: item.description, rarity: item.rarity };
}

router.get("/", async (req, res, next) => {
  if (getClubsConnection().readyState !== 1) return res.status(503).json({ message: "Original GG is temporarily unavailable." });
  const playerId = playerIdFor(req, res);
  if (!playerId) return;
  try {
    const [wallet, inventory, ledger, residence, daily, unlocked] = await Promise.all([
      WorldEconomy.findOne({ playerId }).lean(),
      WorldInventoryItem.find({ playerId }).sort({ acquiredAt: -1 }).lean(),
      WorldEconomyLedger.find({ playerId }).sort({ createdAt: -1 }).limit(20).lean(),
      PlayerResidence.findOne({ ownerPlayerId: playerId }).select("level").lean(),
      WorldDailyProgress.findOne({ playerId, dayKey: utcDayKey() }).lean(),
      WorldAchievement.find({ playerId }).lean(),
    ]);
    return res.json({
      economy: { ...(wallet || { coins: 0, xp: 0, level: 1 }), ...levelProgress(wallet?.xp || 0) },
      catalog: CATALOG.map(publicItem),
      inventory,
      recentTransactions: ledger,
      residence: { level: residence?.level || 1, maxLevel: 10, nextUpgradeCost: residence && residence.level < 10 ? Math.round(100 * Math.pow(residence.level + 1, 1.55)) : null },
      dailyProgress: { xpEarned: daily?.xpEarned || 0, xpRemaining: Math.max(0, WORLD_ECONOMY_RULES.dailyXpCap - (daily?.xpEarned || 0)), coinsEarned: daily?.coinsEarned || 0, coinsRemaining: Math.max(0, WORLD_ECONOMY_RULES.dailyCoinCap - (daily?.coinsEarned || 0)), trainingXpRemaining: Math.max(0, WORLD_ECONOMY_RULES.dailyTrainingXpCap - (daily?.trainingXpEarned || 0)), trainingCoinsRemaining: Math.max(0, WORLD_ECONOMY_RULES.dailyTrainingCoinCap - (daily?.trainingCoinsEarned || 0)), resetsAt: "00:00 UTC" },
      achievements: WORLD_ACHIEVEMENTS.map((achievement) => ({ id: achievement.id, name: achievement.name, description: achievement.description, xp: achievement.xp, coins: achievement.coins, unlocked: unlocked.some((entry) => entry.achievementId === achievement.id), unlockedAt: unlocked.find((entry) => entry.achievementId === achievement.id)?.unlockedAt || null })),
      nextLevelXp: levelProgress(wallet?.xp || 0).nextLevelXp,
    });
  } catch (error) { return next(error); }
});

router.post("/purchase", async (req, res, next) => {
  if (getClubsConnection().readyState !== 1) return res.status(503).json({ message: "Original GG is temporarily unavailable." });
  const playerId = playerIdFor(req, res);
  if (!playerId) return;
  const itemId = String(req.body?.itemId || "").trim();
  const idempotencyKey = String(req.body?.idempotencyKey || "").trim();
  if (!/^[a-zA-Z0-9:_-]{12,100}$/.test(idempotencyKey)) return res.status(400).json({ message: "A valid purchase request key is required." });
  const item = CATALOG.find((entry) => entry.id === itemId);
  if (!item) return res.status(404).json({ message: "That item is not available in the GG Market." });

  const connection = getClubsConnection();
  const session = await connection.startSession();
  let response;
  try {
    await session.withTransaction(async () => {
      const prior = await WorldEconomyLedger.findOne({ playerId, idempotencyKey }).session(session).lean();
      if (prior) {
        response = { success: true, duplicate: true, transaction: prior };
        return;
      }

      const wallet = await WorldEconomy.findOneAndUpdate(
        { playerId },
        { $setOnInsert: { playerId, coins: 0, xp: 0, level: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      ).lean();
      if ((wallet.level || 1) < (item.minLevel || 1)) {
        const error = new Error("Reach player level "+item.minLevel+" to unlock this cosmetic.");
        error.status = 409;
        throw error;
      }
      const charged = await WorldEconomy.findOneAndUpdate(
        { playerId, coins: { $gte: item.price } },
        { $inc: { coins: -item.price } },
        { new: true, session, runValidators: true },
      ).lean();
      if (!charged) {
        const error = new Error("You do not have enough GG Coins for this item.");
        error.status = 409;
        throw error;
      }

      const ownedItem = await WorldInventoryItem.findOne({ playerId, itemId: item.id }).session(session);
      if (ownedItem) {
        ownedItem.quantity += 1;
        await ownedItem.save({ session });
      } else {
        await WorldInventoryItem.create([{
          playerId, itemId: item.id, quantity: 1, acquiredAt: new Date(),
        }], { session });
      }
      const [transaction] = await WorldEconomyLedger.create([{
        playerId, idempotencyKey, type: "purchase", itemId: item.id,
        coinsDelta: -item.price, xpDelta: 0, balanceAfter: charged.coins,
        xpAfter: charged.xp, metadata: { itemName: item.name },
      }], { session });
      response = { success: true, duplicate: false, economy: charged, transaction };
    });
    return res.status(response?.duplicate ? 200 : 201).json(response);
  } catch (error) {
    if (error?.code === 11000) {
      const prior = await WorldEconomyLedger.findOne({ playerId, idempotencyKey }).lean();
      if (prior) return res.json({ success: true, duplicate: true, transaction: prior });
      return res.status(409).json({ message: "This purchase request has already been processed." });
    }
    if (error?.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  } finally {
    await session.endSession();
  }
});


router.post("/equip", async (req, res, next) => {
  if (getClubsConnection().readyState !== 1) return res.status(503).json({ message: "Original GG is temporarily unavailable." });
  const playerId = playerIdFor(req, res);
  if (!playerId) return;
  const itemId = String(req.body?.itemId || "").trim();
  const item = CATALOG.find((entry) => entry.id === itemId);
  if (!item) return res.status(404).json({ message: "That cosmetic is not available." });
  const appearancePatch = itemId === "boots-gold" ? { bootColor: "gold" }
    : itemId === "kit-neon" ? { kitPrimary: "green", kitSecondary: "gold" }
    : itemId === "hair-silver" ? { hairColor: "silver" } : null;
  if (!appearancePatch) return res.status(400).json({ message: "This item cannot be equipped yet." });
  const session = await getClubsConnection().startSession();
  try {
    let avatar;
    await session.withTransaction(async () => {
      const owned = await WorldInventoryItem.findOne({ playerId, itemId, quantity: { $gt: 0 } }).session(session);
      if (!owned) {
        const error = new Error("You need to own this item before equipping it.");
        error.status = 409;
        throw error;
      }
      await WorldInventoryItem.updateMany({ playerId, itemId: { $in: CATALOG.filter((entry) => entry.category === item.category).map((entry) => entry.id) } }, { $set: { equipped: false } }, { session });
      owned.equipped = true;
      await owned.save({ session });
      avatar = await PlayerAvatar.findOneAndUpdate(
        { playerId },
        { $set: Object.fromEntries(Object.entries(appearancePatch).map(([key, value]) => ["appearance."+key, value])) },
        { new: true, upsert: true, setDefaultsOnInsert: true, session, runValidators: true },
      ).lean();
    });
    return res.json({ success: true, itemId, avatar: { appearance: avatar.appearance } });
  } catch(error) {
    if(error?.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  } finally { await session.endSession(); }
});

router.post("/residence-upgrade", async (req, res, next) => {
  if (getClubsConnection().readyState !== 1) return res.status(503).json({ message: "Original GG is temporarily unavailable." });
  const playerId = playerIdFor(req, res);
  if (!playerId) return;
  const requestKey = String(req.body?.idempotencyKey || "").trim();
  if (!/^[a-zA-Z0-9:_-]{12,100}$/.test(requestKey)) return res.status(400).json({ message: "A valid upgrade request key is required." });
  const idempotencyKey = "home:" + requestKey;
  const session = await getClubsConnection().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const prior = await WorldEconomyLedger.findOne({ playerId, idempotencyKey }).session(session).lean();
      if (prior) {
        const [currentHome, currentWallet] = await Promise.all([
          PlayerResidence.findOne({ ownerPlayerId: playerId }).session(session).lean(),
          WorldEconomy.findOne({ playerId }).session(session).lean(),
        ]);
        result = { success: true, duplicate: true, residence: { level: currentHome?.level || 1, name: currentHome?.name }, economy: currentWallet };
        return;
      }
      const home = await PlayerResidence.findOne({ ownerPlayerId: playerId }).session(session);
      if (!home) {
        const error = new Error("Your residence has not been created yet.");
        error.status = 404;
        throw error;
      }
      if (home.level >= 10) {
        const error = new Error("Your home has reached the current upgrade level.");
        error.status = 409;
        throw error;
      }
      const nextLevel = home.level + 1;
      const cost = Math.round(100 * Math.pow(nextLevel, 1.55));
      const currentWallet = await WorldEconomy.findOne({ playerId }).session(session).lean();
      if ((currentWallet?.level || 1) < nextLevel) {
        const error = new Error("Reach player level "+nextLevel+" before upgrading your home to level "+nextLevel+".");
        error.status = 409;
        throw error;
      }
      const wallet = await WorldEconomy.findOneAndUpdate(
        { playerId, coins: { $gte: cost } },
        { $inc: { coins: -cost } },
        { new: true, session, runValidators: true },
      ).lean();
      if (!wallet) {
        const error = new Error("You need "+cost+" GG Coins to upgrade your home.");
        error.status = 409;
        throw error;
      }
      home.level = nextLevel;
      await home.save({ session });
      await WorldEconomyLedger.create([{
        playerId, idempotencyKey,
        type: "upgrade", itemId: "residence-level-"+nextLevel, coinsDelta: -cost,
        xpDelta: 0, balanceAfter: wallet.coins, xpAfter: wallet.xp,
        metadata: { residenceLevel: nextLevel },
      }], { session });
      result = { success: true, residence: { level: home.level, name: home.name }, economy: wallet, cost };
    });
    return res.json(result);
  } catch(error) {
    if(error?.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  } finally { await session.endSession(); }
});

export default router;

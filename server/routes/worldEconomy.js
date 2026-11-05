import express from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import WorldEconomy from "../models/clubs/WorldEconomy.js";
import WorldEconomyLedger from "../models/clubs/WorldEconomyLedger.js";
import WorldInventoryItem from "../models/clubs/WorldInventoryItem.js";

const router = express.Router();
router.use(requireAuth);

const CATALOG = Object.freeze([
  { id: "boots-gold", name: "Golden Boots", category: "boots", price: 120, description: "A bright pair of matchday boots.", rarity: "rare" },
  { id: "kit-neon", name: "Neon Training Kit", category: "kit", price: 180, description: "A vivid training look.", rarity: "rare" },
  { id: "hair-silver", name: "Silver Hair", category: "hair", price: 90, description: "A cool silver hairstyle colour.", rarity: "common" },
  { id: "aura-gold", name: "Golden Aura", category: "effect", price: 350, description: "A subtle golden character aura.", rarity: "epic" },
]);

function playerIdFor(req, res) {
  const id = req.user?.playerProfile;
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(403).json({ message: "Link your GG player profile to use the Original GG economy." });
    return null;
  }
  return id;
}

function levelForXp(xp) {
  // Level N requires 100 * (N - 1)^2 total XP.
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

function publicItem(item) {
  return { id: item.id, name: item.name, category: item.category, price: item.price, description: item.description, rarity: item.rarity };
}

router.get("/", async (req, res, next) => {
  if (getClubsConnection().readyState !== 1) return res.status(503).json({ message: "Original GG is temporarily unavailable." });
  const playerId = playerIdFor(req, res);
  if (!playerId) return;
  try {
    const [wallet, inventory, ledger] = await Promise.all([
      WorldEconomy.findOne({ playerId }).lean(),
      WorldInventoryItem.find({ playerId }).sort({ acquiredAt: -1 }).lean(),
      WorldEconomyLedger.find({ playerId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    return res.json({
      economy: wallet || { coins: 0, xp: 0, level: 1 },
      catalog: CATALOG.map(publicItem),
      inventory,
      recentTransactions: ledger,
      nextLevelXp: Math.pow((wallet?.level || 1), 2) * 100,
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

      await WorldInventoryItem.findOneAndUpdate(
        { playerId, itemId: item.id },
        { $setOnInsert: { playerId, itemId: item.id, acquiredAt: new Date() }, $inc: { quantity: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session, runValidators: true },
      );
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

export default router;

import Club from "../models/clubs/Club.js";
import ClubWalletTransaction from "../models/clubs/ClubWalletTransaction.js";
import PlayerWallet from "../models/clubs/PlayerWallet.js";
import PlayerWalletTransaction from "../models/clubs/PlayerWalletTransaction.js";

export function availableClubBalance(club) {
  return Math.max(0, Number(club?.balance || 0) - Number(club?.committedBalance || 0));
}

export function positiveMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
  return Math.round(amount * 100) / 100;
}

export function nonNegativeMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be zero or greater.");
  return Math.round(amount * 100) / 100;
}

export function activeCaptainApprovalComplete(captainIds, approvalIds) {
  const captains = [...new Set((captainIds || []).map(String))];
  const approvals = new Set((approvalIds || []).map(String));
  return captains.length > 0 && captains.every(id => approvals.has(id));
}

export function validateRetention(memberIds, retainedPlayerIds, captainIds) {
  const members = new Set((memberIds || []).map(String));
  const retained = [...new Set((retainedPlayerIds == null ? [...members] : retainedPlayerIds).map(String))];
  if (members.size < 4 || members.size > 5) {
    throw new Error("A Club must contain four or five members while active.");
  }
  if (retained.length > members.size || retained.length > 5 || retained.some(id => !members.has(id))) {
    throw new Error("A Club renewal can retain only players from the active four or five player squad.");
  }
  if (retained.length >= 4) {
    const retainedCaptains = (captainIds || []).filter(id => retained.includes(String(id)));
    if (retainedCaptains.length === 0) {
      throw new Error("At least one existing captain must be retained when a Club remains active.");
    }
  }
  return retained;
}

async function createClubLedgerEntry({ clubId, type, amount, balanceAfter, description, session, mainMatchId = null, clubMatchId = null, auctionOfferId = null, idempotencyKey = null }) {
  return ClubWalletTransaction.create([{
    clubId,
    type,
    amount,
    balanceAfter,
    description,
    mainMatchId,
    clubMatchId,
    auctionOfferId,
    idempotencyKey,
  }], { session }).then(rows => rows[0]);
}

async function createPlayerLedgerEntry({ playerId, type, amount, balanceAfter, description, session, clubId = null, mainMatchId = null, clubMatchId = null, auctionOfferId = null, idempotencyKey = null }) {
  return PlayerWalletTransaction.create([{
    playerId,
    type,
    amount,
    balanceAfter,
    description,
    clubId,
    mainMatchId,
    clubMatchId,
    auctionOfferId,
    idempotencyKey,
  }], { session }).then(rows => rows[0]);
}

export async function creditClubWallet({ clubId, amount, type = "adjustment", description = "", session, refs = {}, idempotencyKey = null }) {
  const value = positiveMoney(amount);
  const updated = await Club.findOneAndUpdate(
    { _id: clubId },
    { $inc: { balance: value } },
    { new: true, session },
  );
  if (!updated) throw new Error("Club wallet target not found.");
  await createClubLedgerEntry({
    clubId,
    type,
    amount: value,
    balanceAfter: updated.balance,
    description,
    session,
    ...refs,
    idempotencyKey,
  });
  return updated;
}

export async function reserveClubWallet({ clubId, amount, session }) {
  const value = positiveMoney(amount);
  const updated = await Club.findOneAndUpdate(
    {
      _id: clubId,
      $expr: { $gte: [{ $subtract: ["$balance", { $ifNull: ["$committedBalance", 0] }] }, value] },
    },
    { $inc: { committedBalance: value } },
    { new: true, session },
  );
  if (!updated) throw new Error("Club has insufficient available balance for this offer.");
  return updated;
}

export async function releaseClubCommitment({ clubId, amount, session }) {
  const value = positiveMoney(amount);
  const updated = await Club.findOneAndUpdate(
    { _id: clubId, $expr: { $gte: [{ $ifNull: ["$committedBalance", 0] }, value] } },
    [{ $set: { committedBalance: { $subtract: [{ $ifNull: ["$committedBalance", 0] }, value] } } }],
    { new: true, session },
  );
  if (!updated) throw new Error("Club offer reservation could not be released safely.");
  return updated;
}

export async function debitClubWallet({ clubId, amount, type = "expense", description = "", session, refs = {}, idempotencyKey = null, commitmentAmount = 0 }) {
  const value = positiveMoney(amount);
  const commitment = commitmentAmount > 0 ? positiveMoney(commitmentAmount) : 0;
  const filter = { _id: clubId, balance: { $gte: value } };
  const update = { $inc: { balance: -value } };
  if (commitment) {
    filter.$expr = { $gte: [{ $ifNull: ["$committedBalance", 0] }, commitment] };
    update.$inc.committedBalance = -commitment;
  } else {
    filter.$expr = { $gte: [{ $subtract: ["$balance", { $ifNull: ["$committedBalance", 0] }] }, value] };
  }
  const updated = await Club.findOneAndUpdate(filter, update, { new: true, session });
  if (!updated) throw new Error("Club wallet has insufficient available balance or the club no longer exists.");
  await createClubLedgerEntry({
    clubId,
    type,
    amount: -value,
    balanceAfter: updated.balance,
    description,
    session,
    ...refs,
    idempotencyKey,
  });
  return updated;
}

export async function creditPlayerWallet({ playerId, amount, type = "adjustment", description = "", session, refs = {}, idempotencyKey = null }) {
  const value = positiveMoney(amount);
  const wallet = await PlayerWallet.findOneAndUpdate(
    { playerId },
    { $inc: { balance: value }, $setOnInsert: { playerId } },
    { upsert: true, new: true, session },
  );
  await createPlayerLedgerEntry({
    playerId,
    type,
    amount: value,
    balanceAfter: wallet.balance,
    description,
    session,
    ...refs,
    idempotencyKey,
  });
  return wallet;
}

export async function creditPlayerMatchReward({ playerId, amount, description = "", session, clubId = null, mainMatchId = null, clubMatchId = null, idempotencyKey = null }) {
  return creditPlayerWallet({
    playerId,
    amount,
    type: "individual_match_reward",
    description,
    session,
    refs: { clubId, mainMatchId, clubMatchId },
    idempotencyKey,
  });
}

export async function creditClubMatchReward({ clubId, amount, description = "", session, mainMatchId = null, clubMatchId = null, idempotencyKey = null }) {
  return creditClubWallet({
    clubId,
    amount,
    type: "match_reward",
    description,
    session,
    refs: { mainMatchId, clubMatchId },
    idempotencyKey,
  });
}

export async function debitPlayerWallet({ playerId, amount, type = "betting_stake", description = "", session, refs = {}, idempotencyKey = null }) {
  const value = positiveMoney(amount);
  const wallet = await PlayerWallet.findOneAndUpdate(
    { playerId, balance: { $gte: value } },
    { $inc: { balance: -value } },
    { new: true, session },
  );
  if (!wallet) throw new Error("Player wallet has insufficient balance.");
  await createPlayerLedgerEntry({
    playerId,
    type,
    amount: -value,
    balanceAfter: wallet.balance,
    description,
    session,
    ...refs,
    idempotencyKey,
  });
  return wallet;
}

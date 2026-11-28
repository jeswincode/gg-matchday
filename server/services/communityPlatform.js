import mongoose from "mongoose";
import User from "../models/User.js";
import Player from "../models/Player.js";
import { claimImportedFoundingLink } from "./foundingLinks.js";
import { communityPlayerId } from "./workspaceRecords.js";
import {
  CommunityStore, RequestConflict, foundingCommunityId, isDuplicateKey,
} from "../../packages/data/community-store.ts";

const previewService = "srv-dc2642dg1s2s73935v0g";
const publicService = "srv-dafvbk8u01pc73c6hdsg";
let store;

export function communitiesEnabled() {
  return Boolean(store);
}

function communitiesConfigured() {
  if (process.env.RENDER_SERVICE_ID) {
    return process.env.RENDER_SERVICE_ID === previewService ||
      (process.env.RENDER_SERVICE_ID === publicService && process.env.BALLERS_COMMUNITIES_DISABLED !== "true");
  }
  return process.env.NODE_ENV !== "production" && process.env.V42_COMMUNITIES === "true";
}

export async function prepareCommunityPlatform() {
  if (!communitiesConfigured()) return;
  const db = mongoose.connection.db;
  if (!db || (process.env.RENDER_SERVICE_ID === previewService && db.databaseName !== "gg_matchday_v42_demo")) {
    throw new Error("Communities require the isolated V4.2 core database.");
  }
  const production = process.env.RENDER_SERVICE_ID === publicService;
  if (production && db.databaseName === "gg_matchday_v42_demo") {
    throw new Error("The public service requires its existing production database.");
  }
  const client = mongoose.connection.getClient();
  const location = prefix => ({ client, db: { collection: name => db.collection(prefix + name) } });
  const registry = location("platform_registry_");
  const football = location("platform_football_");
  const candidate = new CommunityStore(registry, new Map([["primary", football]]), "primary");
  try {
    await candidate.initialize();
  } catch (error) {
    if (!production) throw error;
    // Keep serving the existing Matchday app if provisioning the registry fails.
    console.error("Community registry initialization failed. Matchday remains available.", {
      errorName: error?.name || "Error",
    });
    return;
  }
  store = candidate;
}

export function communityStore() {
  if (!store) throw Object.assign(new Error("Community storage is unavailable."), { status: 503 });
  return store;
}

export function verifiedCommunityIdentity(req) {
  return req.firebaseUser?.email_verified === true ||
    (process.env.NODE_ENV === "test" && req.firebaseUser?.testOnly === true);
}

export async function synchronizeCommunityIdentity(req) {
  const platform = communityStore();
  const { firebaseUser, user } = req;
  const admin = user.role === "admin";
  if (process.env.RENDER_SERVICE_ID !== publicService &&
      !admin && !user.playerProfile && firebaseUser.email_verified === true) {
    const imported = await claimImportedFoundingLink(mongoose.connection, {
      email: firebaseUser.email, firebaseUid: firebaseUser.uid, userId: user._id,
    });
    if (imported) user.playerProfile = imported;
  }
  const linkedId = user.playerProfile || null;
  const [player, accounts] = !admin && linkedId ? await Promise.all([
    Player.findById(linkedId).select("name bio preferredFoot preferredPositions jerseyNumber").lean(),
    User.find({ playerProfile: linkedId }).select("_id").limit(2).lean(),
  ]) : [null, []];
  const linkedPlayer = Boolean(player);
  const soleLink = linkedPlayer && accounts.length === 1 && String(accounts[0]._id) === String(user._id);
  const name = (linkedPlayer ? player.name : user.name).slice(0, 80);
  const initial = { displayName: name };
  if (linkedPlayer) {
    if (player.bio) initial.bio = player.bio.slice(0, 400);
    const foot = player.preferredFoot?.toLowerCase();
    if (["left", "right", "both"].includes(foot)) initial.preferredFoot = foot;
    if (player.jerseyNumber >= 1 && player.jerseyNumber <= 99) initial.shirtNumber = player.jerseyNumber;
    if (player.preferredPositions?.length) initial.preferredPositions = player.preferredPositions.slice(0, 5);
  }
  const account = await platform.account(firebaseUser.uid, initial);
  if (!admin && !linkedId && (await platform.foundingMembership(account))?.admitted) {
    const profile = await platform.profile(account);
    const newPlayerId = communityPlayerId(account.globalPlayerId);
    const client = mongoose.connection.getClient();
    await client.withSession(session => session.withTransaction(async () => {
      const stillUnlinked = await User.exists({ _id: user._id, playerProfile: null }).session(session);
      if (!stillUnlinked) return;
      const displayName = profile?.displayName || user.name;
      const duplicateName = await Player.exists({ name: displayName, _id: { $ne: newPlayerId } }).session(session);
      const nameForRoster = duplicateName ? displayName + " · " + String(newPlayerId).slice(-6) : displayName;
      await Player.updateOne({ _id: newPlayerId }, { $setOnInsert: { name: nameForRoster } }, { upsert: true, session });
      await User.updateOne({ _id: user._id }, { $set: { playerProfile: newPlayerId } }, { session });
    }));
    const current = await User.findById(user._id).select("playerProfile").lean();
    if (current?.playerProfile) {
      user.playerProfile = current.playerProfile;
      if (String(current.playerProfile) === String(newPlayerId)) await platform.syncFounding(account, String(newPlayerId), false);
      return { account, linkNeedsReview: false };
    }
  }
  let linkNeedsReview = Boolean(linkedId && !admin && !linkedPlayer);
  try {
    await platform.syncFounding(account, soleLink ? String(player._id) : null, admin, linkedPlayer && !soleLink);
  } catch (error) {
    if (!(error instanceof RequestConflict) && !isDuplicateKey(error)) throw error;
    if (linkedPlayer) await platform.syncFounding(account, null, false, true);
    linkNeedsReview = true;
  }
  if (linkedPlayer) await platform.seedLinkedName(account, String(player._id), player.name);
  return { account, linkNeedsReview };
}

export async function canEnterFounding(req) {
  if (!verifiedCommunityIdentity(req)) return false;
  if (req.user.role === "admin") return true;
  if (req.user.playerProfile && await Player.exists({ _id: req.user.playerProfile })) return true;
  const platform = communityStore();
  const account = await platform.accountBySubject(req.firebaseUser.uid);
  if (!account) return false;
  const member = await platform.foundingMembership(account);
  return Boolean(member?.admitted);
}

export { foundingCommunityId };

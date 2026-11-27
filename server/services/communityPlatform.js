import mongoose from "mongoose";
import User from "../models/User.js";
import Player from "../models/Player.js";
import { claimImportedFoundingLink } from "./foundingLinks.js";
import {
  CommunityStore, RequestConflict, foundingCommunityId, isDuplicateKey,
} from "../../packages/data/community-store.ts";

const previewService = "srv-dc2642dg1s2s73935v0g";
let store;

export function communitiesEnabled() {
  if (process.env.RENDER_SERVICE_ID) return process.env.RENDER_SERVICE_ID === previewService;
  return process.env.NODE_ENV !== "production" && process.env.V42_COMMUNITIES === "true";
}

export async function prepareCommunityPlatform() {
  if (!communitiesEnabled()) return;
  const db = mongoose.connection.db;
  if (!db || (process.env.RENDER_SERVICE_ID === previewService && db.databaseName !== "gg_matchday_v42_demo")) {
    throw new Error("Communities require the isolated V4.2 core database.");
  }
  const client = mongoose.connection.getClient();
  const location = prefix => ({ client, db: { collection: name => db.collection(prefix + name) } });
  const registry = location("platform_registry_");
  const football = location("platform_football_");
  const candidate = new CommunityStore(registry, new Map([["primary", football]]), "primary");
  await candidate.initialize();
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
  if (!admin && !user.playerProfile && firebaseUser.email_verified === true) {
    const imported = await claimImportedFoundingLink(mongoose.connection, {
      email: firebaseUser.email, firebaseUid: firebaseUser.uid, userId: user._id,
    });
    if (imported) user.playerProfile = imported;
  }
  const linkedId = user.playerProfile || null;
  const [player, accounts] = !admin && linkedId ? await Promise.all([
    Player.findById(linkedId).select("name bio preferredFoot preferredPositions shirtNumber").lean(),
    User.find({ playerProfile: linkedId }).select("_id").limit(2).lean(),
  ]) : [null, []];
  const verifiedLink = player && accounts.length === 1 && String(accounts[0]._id) === String(user._id);
  const name = (player?.name && verifiedLink ? player.name : user.name).slice(0, 80);
  const initial = { displayName: name };
  if (verifiedLink) {
    if (player.bio) initial.bio = player.bio.slice(0, 400);
    if (["left", "right", "both"].includes(player.preferredFoot)) initial.preferredFoot = player.preferredFoot;
    if (player.shirtNumber >= 1 && player.shirtNumber <= 99) initial.shirtNumber = player.shirtNumber;
    if (player.preferredPositions?.length) initial.preferredPositions = player.preferredPositions.slice(0, 5);
  }
  const account = await platform.account(firebaseUser.uid, initial);
  let linkNeedsReview = Boolean(linkedId && !admin && !verifiedLink);
  try {
    await platform.syncFounding(account, verifiedLink ? String(player._id) : null, admin);
  } catch (error) {
    if (!(error instanceof RequestConflict) && !isDuplicateKey(error)) throw error;
    linkNeedsReview = true;
  }
  return { account, linkNeedsReview };
}

export async function canEnterFounding(req) {
  if (!verifiedCommunityIdentity(req)) return false;
  if (req.user.role === "admin") return true;
  const platform = communityStore();
  const account = await platform.accountBySubject(req.firebaseUser.uid);
  if (!account) return false;
  const member = await platform.foundingMembership(account);
  if (!member) return false;
  if (member.admitted) return true;
  const linked = req.user.playerProfile;
  if (!linked || String(linked) !== member.legacyPlayerId) return false;
  const [player, count] = await Promise.all([
    Player.exists({ _id: linked }),
    User.countDocuments({ playerProfile: linked }, { limit: 2 }),
  ]);
  return Boolean(player && count === 1);
}

export { foundingCommunityId };

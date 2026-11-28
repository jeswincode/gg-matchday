import mongoose from "mongoose";
import User from "../models/User.js";
import Player from "../models/Player.js";
import { AccessError } from "../../packages/data/community-store.ts";
import { communityStore, synchronizeCommunityIdentity, verifiedCommunityIdentity, foundingCommunityId } from "./communityPlatform.js";
import { inWorkspace, readyWorkspace, workspaceCollection } from "../config/workspaceModels.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import { communityPlayerId, importWorkspaceRecords } from "./workspaceRecords.js";

export async function initializeWorkspace() {
  const baseClubs = getClubsConnection();
  const [core] = await Promise.all([
    readyWorkspace(mongoose.connection),
    baseClubs.readyState === 1 && readyWorkspace(baseClubs),
  ]);
  return core;
}

export async function forMatchdayWorkspaces(operation) {
  await operation();
  if (!mongoose.connection.db) return;
  const workspaces = mongoose.connection.db.collection("platform_registry_workspaceActivity");
  for await (const { _id } of workspaces.find({}, { projection: { _id: 1 } })) {
    try { await inWorkspace(_id, operation); }
    catch (error) { console.error("Community maintenance failed.", { errorName: error?.name || "Error" }); }
  }
}

async function memberUser(user, membership, profile) {
  const playerId = communityPlayerId(membership.playerId);
  await Player.updateOne({ _id: playerId }, { $setOnInsert: { name: profile.displayName || user.name } },
    { upsert: true, timestamps: false });
  const current = await User.findById(user._id);
  const isManager = ["owner", "admin"].includes(membership.role);
  const role = isManager ? "admin" : membership.role === "staff" || current?.role === "editor" ? "editor" : "viewer";
  const name = profile.displayName || user.name;
  if (current && current.role === role && current.name === name && current.email === user.email &&
      current.profileImage === user.profileImage && String(current.playerProfile) === String(playerId)) return current;
  return User.findOneAndUpdate({ _id: user._id }, {
    $set: { firebaseUid: user.firebaseUid, email: user.email, name, profileImage: user.profileImage,
      role, playerProfile: playerId },
  }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
}

export async function withCommunityWorkspace(req, res, next) {
  const id = req.params.workspaceId;
  if (!verifiedCommunityIdentity(req) || !/^[a-f0-9]{64}$/.test(id) || id === foundingCommunityId) {
    return res.status(404).json({ message: "This community is unavailable." });
  }
  const rootUser = req.user;
  const platform = communityStore();
  const account = await platform.accountBySubject(req.firebaseUser.uid) || (await synchronizeCommunityIdentity(req)).account;
  let membership;
  try { membership = await platform.openCommunity(account, id); }
  catch (error) {
    if (error instanceof AccessError) return res.status(404).json({ message: "This community is unavailable." });
    throw error;
  }
  if (!membership.playerId) return res.status(403).json({ message: "Your community player is unavailable." });
  const profile = await platform.profile(account);
  if (!profile?.username) return res.status(409).json({ message: "Choose a player name and Player ID first." });
  return inWorkspace(id, async () => {
    const connection = await initializeWorkspace();
    await importWorkspaceRecords(id, connection);
    req.platformUser = rootUser;
    req.community = membership;
    req.user = await memberUser(rootUser, membership, profile);
    next();
  });
}

export async function updateWorkspaceProfile(account, patch, req) {
  const platform = communityStore();
  if (!patch.displayName) return platform.updateProfile(account, patch);
  const founding = await platform.foundingMembership(account);
  const name = patch.displayName;
  const db = mongoose.connection.db;
  return mongoose.connection.getClient().withSession(session => session.withTransaction(async () => {
    const rootPlayer = req.user.playerProfile;
    if (rootPlayer && founding?.legacyPlayerId === String(rootPlayer)) {
      await Player.updateOne({ _id: rootPlayer }, { $set: { name } }, { session });
    }
    const memberships = db.collection("platform_football_communityPlayers").find({ globalPlayerId: account.globalPlayerId,
      communityId: { $ne: foundingCommunityId } }, { session });
    for await (const membership of memberships) {
      await db.collection(workspaceCollection(membership.communityId, "players")).updateOne(
        { _id: communityPlayerId(membership._id) }, { $set: { name, updatedAt: new Date() } }, { session },
      );
    }
    return platform.updateProfile(account, patch, session);
  }));
}

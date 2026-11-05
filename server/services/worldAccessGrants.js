import mongoose from "mongoose";
import WorldAccessGrant from "../models/WorldAccessGrant.js";
import WorldMembership from "../models/WorldMembership.js";
import User from "../models/User.js";
import { getPrimaryWorld } from "./primaryWorld.js";

const GMAIL_LOCAL_PATTERN = /^[a-z0-9][a-z0-9.]{4,28}[a-z0-9]$/;

export function normalizeGmailAddress(value) {
  return String(value || "").trim().toLowerCase();
}

export function isGmailAddress(value) {
  const email = normalizeGmailAddress(value);
  const separator = email.lastIndexOf("@");
  if (separator < 0 || email.slice(separator + 1) !== "gmail.com") return false;
  const local = email.slice(0, separator);
  return GMAIL_LOCAL_PATTERN.test(local) && !local.includes("..");
}

/**
 * Grandfather existing Matchday accounts into the single World without
 * bypassing Firebase verification. Existing non-admin accounts receive an
 * invitation at their already-persisted Gmail address and keep their prior
 * read/write level; the grant activates only after exact verified sign-in.
 * New accounts are never included by this bootstrap.
 */
export async function ensureLegacyWorldAccessInvitations(world) {
  if (!world?._id) throw new Error("A primary World is required to preserve existing account access.");
  const adminEmail = normalizeGmailAddress(process.env.ADMIN_EMAIL);
  const platformAdmin = await User.findOne({ email: adminEmail, role: "admin" }).select("_id").lean();
  if (!platformAdmin) throw new Error("The configured platform administrator is required to preserve existing account access.");

  await WorldAccessGrant.init();
  const users = await User.find({ email: { $exists: true, $ne: "" } })
    .select("_id email role")
    .lean();
  let invited = 0;
  let skipped = 0;

  for (const user of users) {
    const email = normalizeGmailAddress(user.email);
    if (!isGmailAddress(email) || email === adminEmail) {
      skipped += 1;
      continue;
    }
    const role = user.role === "editor" ? "editor" : "viewer";
    const result = await WorldAccessGrant.updateOne(
      { worldId: world._id, email },
      {
        $setOnInsert: {
          worldId: world._id,
          email,
          role,
          status: "invited",
          invitedBy: platformAdmin._id,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    if (result.upsertedCount === 1) invited += 1;
    else skipped += 1;
  }

  return { existingAccountsChecked: users.length, invitationsCreated: invited, skipped };
}

/**
 * Invites activate only for the exact Firebase-verified Gmail identity and
 * matching persisted Firebase UID. Grant and membership updates are atomic.
 */
export async function activatePendingWorldAccessGrant({ user, firebaseUser } = {}) {
  if (!user?._id || firebaseUser?.email_verified !== true || !firebaseUser?.uid) return null;
  const email = normalizeGmailAddress(firebaseUser.email);
  if (
    !isGmailAddress(email) ||
    normalizeGmailAddress(user.email) !== email ||
    String(user.firebaseUid) !== String(firebaseUser.uid)
  ) return null;

  const world = await getPrimaryWorld();
  // Avoid opening a transaction for every authenticated API call when the
  // exact verified mailbox has no pending invitation. Re-check inside the
  // transaction to remain safe against invitation/revocation races.
  const pendingGrant = await WorldAccessGrant.exists({
    worldId: world._id,
    email,
    status: "invited",
  });
  if (!pendingGrant) return null;

  const session = await mongoose.startSession();
  let activatedGrant = null;
  try {
    await session.withTransaction(async () => {
      const grant = await WorldAccessGrant.findOne({
        worldId: world._id,
        email,
        status: "invited",
      }).session(session);
      if (!grant) return;

      const now = new Date();
      const membership = await WorldMembership.findOneAndUpdate(
        { worldId: world._id, userId: user._id },
        {
          $set: {
            role: grant.role,
            status: "active",
            approvedAt: now,
            approvedBy: null,
            rejectedAt: null,
            rejectedBy: null,
            decisionNote: "",
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, session },
      );
      if (!membership) {
        const error = new Error("Could not activate the invited World membership.");
        error.status = 503;
        error.code = "WORLD_ACCESS_ACTIVATION_FAILED";
        throw error;
      }

      grant.status = "active";
      grant.userId = user._id;
      grant.activatedAt = now;
      grant.revokedAt = null;
      grant.revokedBy = null;
      await grant.save({ session });
      activatedGrant = grant;
    });
  } finally {
    await session.endSession();
  }
  return activatedGrant;
}

export async function activateGrantForExistingUser(args) {
  return activatePendingWorldAccessGrant(args);
}

export async function hasActiveWorldAccessGrant({ worldId, userId, email, emailVerified } = {}) {
  const normalizedEmail = normalizeGmailAddress(email);
  if (!worldId || !userId || emailVerified !== true || !isGmailAddress(normalizedEmail)) return false;
  return Boolean(await WorldAccessGrant.exists({
    worldId,
    userId,
    email: normalizedEmail,
    status: "active",
  }));
}

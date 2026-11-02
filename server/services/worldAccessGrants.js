import mongoose from "mongoose";
import WorldAccessGrant from "../models/WorldAccessGrant.js";
import WorldMembership from "../models/WorldMembership.js";
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

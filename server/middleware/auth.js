import mongoose from "mongoose";
import { timingSafeEqual } from "node:crypto";
import User from "../models/User.js";
import {
  hasAdminRoleAuthority,
  isVerifiedConfiguredAdminEmail,
} from "../services/adminIdentityPolicy.js";

import getFirebaseAdmin from "../config/firebaseAdmin.js";
import { activatePendingWorldAccessGrant } from "../services/worldAccessGrants.js";

// ==================================================
// REQUIRE VALID FIREBASE LOGIN
// ==================================================

export async function requireAuth(
  req,
  res,
  next
) {
  if (req.user && req.firebaseUser) return next();
  try {
    const testToken = String(req.headers["x-e2e-test-token"] || "");
    if (testToken) {
      const secret = String(process.env.E2E_TEST_AUTH_SECRET || "");
      const expected = Buffer.from(secret);
      const supplied = Buffer.from(testToken);
      const matches = process.env.NODE_ENV !== "production" && secret.length > 0 &&
        expected.length === supplied.length && timingSafeEqual(expected, supplied);
      if (!matches) {
        return res.status(401).json({ message: "Invalid test authentication token." });
      }

      const roleHeader = String(req.headers["x-e2e-test-role"] || "viewer");
      const role = ["viewer", "editor", "admin"].includes(roleHeader) ? roleHeader : "viewer";
      const requestedPlayerId = String(req.headers["x-e2e-test-player-id"] || "");
      const playerProfile = mongoose.isValidObjectId(requestedPlayerId)
        ? new mongoose.Types.ObjectId(requestedPlayerId)
        : null;
      const uid = `e2e-test:${role}:${playerProfile ? String(playerProfile) : "unlinked"}`;
      const user = await User.findOneAndUpdate(
        { firebaseUid: uid },
        { $set: {
          name: `Playwright ${role}`,
          email: `playwright-${role}-${playerProfile ? String(playerProfile) : "unlinked"}@test.invalid`,
          profileImage: "",
          role,
          accessRequest: "none",
          playerProfile,
        } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true },
      );
      req.firebaseUser = { uid, email: user.email, email_verified: true, testOnly: true };
      req.user = user;
      return next();
    }

    const header =
      req.headers.authorization ||
      "";

    if (
      !header.startsWith(
        "Bearer "
      )
    ) {
      return res.status(
        401
      ).json({
        message:
          "Authentication required.",
      });
    }

    const token =
      header.substring(
        7
      );

    const firebaseAuth =
      getFirebaseAdmin();

    const decoded =
      await firebaseAuth.verifyIdToken(
        token
      );

    const firebaseUid =
      decoded.uid;

    const email =
      (
        decoded.email ||
        ""
      ).toLowerCase()
        .trim();

    const name =
      decoded.name ||
      email ||
      "GG Matchday User";

    const photoURL =
      decoded.picture ||
      "";

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const isConfiguredAdmin = isVerifiedConfiguredAdminEmail(
      email,
      decoded.email_verified,
      configuredAdminEmail,
    );

    let user = await User.findOne({ firebaseUid });
    if (!user) {
      const role = isConfiguredAdmin ? "admin" : "viewer";
      try {
        user = await User.create({
          firebaseUid,
          email,
          emailVerified: decoded.email_verified === true,
          name,
          profileImage: photoURL,
          role,
          platformRole: isConfiguredAdmin ? "platform_admin" : "user",
          accessRequest: "none",
        });
      } catch (createError) {
        const firebaseUidCollision = createError?.code === 11000 &&
          (createError?.keyPattern?.firebaseUid || String(createError?.message || "").includes("firebaseUid_1"));
        if (!firebaseUidCollision) throw createError;
        user = await User.findOne({ firebaseUid });
        if (!user) throw createError;
      }
    }

    let changed = false;
    if (email && email !== user.email) { user.email = email; changed = true; }
    if (name && name !== user.name) { user.name = name; changed = true; }
    if (photoURL && photoURL !== user.profileImage) { user.profileImage = photoURL; changed = true; }

    const verified = decoded.email_verified === true;
    const expectedPlatformRole = isConfiguredAdmin ? "platform_admin" : "user";
    if (user.emailVerified !== verified) { user.emailVerified = verified; changed = true; }
    if (user.platformRole !== expectedPlatformRole) {
      user.platformRole = expectedPlatformRole;
      changed = true;
    }

    if (isConfiguredAdmin) {
      if (user.role !== "admin") { user.role = "admin"; changed = true; }
      if (user.accessRequest !== "none") { user.accessRequest = "none"; changed = true; }
    } else if (user.role === "admin") {
      user.role = "viewer";
      user.accessRequest = "none";
      changed = true;
    }

    if (changed) await user.save();

    req.firebaseUser = decoded;
    req.user = user;

    // A pending invitation activates only after Firebase proves the exact
    // Gmail address and UID. Failures leave the account unlinked and denied.
    if (!isConfiguredAdmin && verified) {
      try {
        await activatePendingWorldAccessGrant({ user, firebaseUser: decoded });
      } catch (activationError) {
        console.error(JSON.stringify({
          event: "world_access_invitation_activation_failed",
          errorName: activationError?.name || "Error",
          code: activationError?.code || null,
        }));
      }
    }

    return next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    return res.status(
      401
    ).json({
      message:
        "Invalid or expired authentication token.",
    });
  }
}

// ==================================================
// REQUIRE EDITOR OR ADMIN
// ==================================================

export async function requireEditor(
  req,
  res,
  next
) {
  try {
    if (
      !req.user
    ) {
      return res.status(
        401
      ).json({
        message:
          "Authentication required.",
      });
    }

    const editorRoleAllowed = req.user.role === "editor";
    const adminRoleAllowed = hasAdminRoleAuthority({
      role: req.user.role,
      emailVerified: req.firebaseUser?.email_verified,
      testOnly: req.firebaseUser?.testOnly === true,
      environment: process.env.NODE_ENV,
    });
    if (!editorRoleAllowed && !adminRoleAllowed) {
      return res.status(403).json({ message: "Editor access required." });
    }

    next();
  } catch (error) {
    console.error(
      "Editor authorization error:",
      error
    );

    return res.status(
      403
    ).json({
      message:
        "Editor access denied.",
    });
  }
}

// ==================================================
// REQUIRE ADMIN
// ==================================================

export async function requireAdmin(
  req,
  res,
  next
) {
  try {
    if (
      !req.user
    ) {
      return res.status(
        401
      ).json({
        message:
          "Authentication required.",
      });
    }

    if (!hasAdminRoleAuthority({
      role: req.user.role,
      emailVerified: req.firebaseUser?.email_verified,
      testOnly: req.firebaseUser?.testOnly === true,
      environment: process.env.NODE_ENV,
    })) {
      return res.status(403).json({ message: "Admin access required." });
    }

    next();
  } catch (error) {
    console.error(
      "Admin authorization error:",
      error
    );

    return res.status(
      403
    ).json({
      message:
        "Admin access denied.",
    });
  }
}
export function optionalAuth(req,res,next) { return req.headers.authorization ? requireAuth(req,res,next) : next(); }

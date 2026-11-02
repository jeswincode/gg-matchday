import express from "express";
import mongoose from "mongoose";

import WorldMembership from "../models/WorldMembership.js";
import WorldAccessGrant from "../models/WorldAccessGrant.js";
import Player from "../models/Player.js";
import { requireAuth } from "../middleware/auth.js";
import { resolveWorldContext } from "../middleware/worldContext.js";
import {
  requireActiveWorldMembership,
  requireWorldCapability,
  requirePlatformAdmin,
} from "../middleware/worldPermissions.js";
import { getWorldMapSnapshot, moveWorldMapFacility } from "../services/worldMapLayout.js";
import { getPrimaryWorld } from "../services/primaryWorld.js";
import { normalizeGmailAddress, isGmailAddress } from "../services/worldAccessGrants.js";
import { isPlatformAdministrator } from "../services/worldAccess.js";

const router = express.Router();


// Platform-admin access management for the one shared GG football World.
router.post("/admin/primary/ensure", requireAuth, requirePlatformAdmin, asyncRoute(async (req, res) => {
  const world = await getPrimaryWorld();
  const membership = await WorldMembership.findOneAndUpdate(
    { worldId: world._id, userId: req.user._id },
    { $set: { role: "owner", status: "active", approvedAt: new Date(), approvedBy: null,
      rejectedAt: null, rejectedBy: null, decisionNote: "" } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  return res.json({ world: safeWorld(world), membership: { role: membership.role, status: membership.status }, ensured: true });
}));

router.get("/admin/access", requireAuth, requirePlatformAdmin, asyncRoute(async (req, res) => {
  const world = await getPrimaryWorld();
  const grants = await WorldAccessGrant.find({ worldId: world._id })
    .populate({ path: "userId", select: "name email" })
    .populate({ path: "invitedBy", select: "name" })
    .populate({ path: "revokedBy", select: "name" })
    .sort({ updatedAt: -1, email: 1 }).lean();
  return res.json({ grants: grants.map(grant => ({
    id: String(grant._id), email: grant.email, role: grant.role, status: grant.status,
    user: grant.userId ? { id: String(grant.userId._id), name: grant.userId.name || "", email: grant.userId.email || "" } : null,
    invitedBy: grant.invitedBy ? { id: String(grant.invitedBy._id), name: grant.invitedBy.name || "" } : null,
    revokedBy: grant.revokedBy ? { id: String(grant.revokedBy._id), name: grant.revokedBy.name || "" } : null,
    createdAt: grant.createdAt, activatedAt: grant.activatedAt, revokedAt: grant.revokedAt, updatedAt: grant.updatedAt,
  })) });
}));

router.post("/admin/access", requireAuth, requirePlatformAdmin, asyncRoute(async (req, res) => {
  const allowed = new Set(["email", "role"]);
  if (Object.keys(req.body || {}).some(key => !allowed.has(key))) return res.status(400).json({
    message: "Access invitation contains unsupported fields.", code: "WORLD_ACCESS_FIELDS_INVALID",
  });
  const email = normalizeGmailAddress(req.body?.email);
  if (!isGmailAddress(email)) return res.status(400).json({
    message: "Enter a valid Gmail address.", code: "WORLD_ACCESS_GMAIL_REQUIRED",
  });
  const role = req.body?.role || "member";
  if (!["member", "editor"].includes(role)) return res.status(400).json({
    message: "Choose Member or Editor access.", code: "WORLD_ACCESS_ROLE_INVALID",
  });

  const world = await getPrimaryWorld();
  const existing = await WorldAccessGrant.findOne({ worldId: world._id, email });
  if (existing && existing.status !== "revoked") return res.status(409).json({
    message: "This Gmail address already has an invitation or active World access.", code: "WORLD_ACCESS_GRANT_EXISTS",
  });
  let grant;
  if (existing) {
    existing.role = role; existing.status = "invited"; existing.userId = null;
    existing.invitedBy = req.user._id; existing.activatedAt = null; existing.revokedAt = null; existing.revokedBy = null;
    grant = await existing.save();
  } else {
    try {
      grant = await WorldAccessGrant.create({ worldId: world._id, email, role, status: "invited", invitedBy: req.user._id });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      return res.status(409).json({ message: "An invitation for this Gmail address was created at the same time.", code: "WORLD_ACCESS_GRANT_EXISTS" });
    }
  }
  return res.status(201).json({
    message: "Gmail invitation created. Access activates after verified Google sign-in.",
    grant: { id: String(grant._id), email: grant.email, role: grant.role, status: grant.status, createdAt: grant.createdAt },
  });
}));

router.delete("/admin/access/:grantId", requireAuth, requirePlatformAdmin, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.grantId)) return res.status(400).json({
    message: "Invalid access grant id.", code: "WORLD_ACCESS_GRANT_ID_INVALID",
  });
  const world = await getPrimaryWorld();
  const session = await mongoose.startSession();
  let revokedGrant = null;
  try {
    await session.withTransaction(async () => {
      revokedGrant = await WorldAccessGrant.findOneAndUpdate(
        { _id: req.params.grantId, worldId: world._id, status: { $in: ["invited", "active"] } },
        { $set: { status: "revoked", revokedAt: new Date(), revokedBy: req.user._id } },
        { new: true, session },
      );
      if (revokedGrant?.userId) await WorldMembership.updateOne(
        { worldId: world._id, userId: revokedGrant.userId, status: "active" },
        { $set: { status: "suspended" } }, { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (!revokedGrant) return res.status(404).json({
    message: "Active or invited access grant not found.", code: "WORLD_ACCESS_GRANT_NOT_FOUND",
  });
  return res.json({
    message: "World access revoked. Future protected API requests are denied.",
    grant: { id: String(revokedGrant._id), email: revokedGrant.email, status: revokedGrant.status, revokedAt: revokedGrant.revokedAt },
  });
}));

// Public projection: a single safe shared World, never the private interior.
router.get("/map", asyncRoute(async (req, res) => {
  const world = await getPrimaryWorld();
  return res.json({ worlds: [safeWorld(world)], availablePlots: [] });
}));

async function accountWorldAccess(req, world) {
  const email = normalizeGmailAddress(req.firebaseUser?.email || req.user?.email);
  if (req.firebaseUser?.testOnly === true && process.env.NODE_ENV !== "production") {
    const role = req.user?.role === "admin" ? "owner" : req.user?.role === "editor" ? "editor" : "member";
    return { role, status: "active", playerProfileId: req.user?.playerProfile || null };
  }
  const [membership, grant] = await Promise.all([
    req.user?._id ? WorldMembership.findOne({ worldId: world._id, userId: req.user._id }).lean() : null,
    req.user?._id && email ? WorldAccessGrant.findOne({ worldId: world._id, email }).lean() : null,
  ]);
  if (isPlatformAdministrator(req.user, req.firebaseUser)) {
    return { role: "owner", status: "active", playerProfileId: membership?.playerProfileId || null };
  }
  const activeGrant = grant?.status === "active" && String(grant.userId) === String(req.user?._id) &&
    req.firebaseUser?.email_verified === true && email === normalizeGmailAddress(req.user?.email);
  let status = "none";
  if (grant?.status === "invited") status = "invited";
  else if (grant?.status === "revoked") status = "revoked";
  else if (activeGrant && membership?.status === "active") status = "active";
  else if (membership?.status === "suspended") status = "suspended";
  else if (membership?.status === "active") status = "not_linked";
  return {
    role: status === "active" ? grant.role : (grant?.role || "member"),
    status,
    playerProfileId: status === "active" ? (membership?.playerProfileId || null) : null,
  };
}

router.get("/me", requireAuth, asyncRoute(async (req, res) => {
  const world = await getPrimaryWorld();
  const membership = await accountWorldAccess(req, world);
  return res.json({ worlds: [{ ...safeWorld(world), membership }] });
}));

// World creation is disabled; the admin links accounts to the existing World.
router.post("/", requireAuth, (req, res) => res.status(403).json({
  message: "GG has one shared football World. World creation is disabled.",
  code: "SINGLE_WORLD_ONLY",
}));



function safeWorld(world) {
  return {
    slug: world.slug,
    name: world.name,
    description: world.description || "",
    emblem: String(world.name || "GG").trim().slice(0, 2).toUpperCase(),
    emblemAssetId: world.branding?.emblemAssetId || null,
    accentColor: world.branding?.accentColor || "#c5a45b",
    globalMap: {
      mapId: world.globalMap?.mapId || "gg-main-v1",
      slotIndex: Number.isSafeInteger(world.globalMap?.slotIndex) ? world.globalMap.slotIndex : null,
      // The one existing GG kingdom remains visible before any map-placement migration.
      x: Number.isFinite(world.globalMap?.x) ? world.globalMap.x : 0,
      y: Number.isFinite(world.globalMap?.y) ? world.globalMap.y : 0,
    },
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Link an existing World-specific Player profile to the signed-in account.
// Profile ownership is recorded on WorldMembership, never inferred from a
// globally unique player name or the legacy User.playerProfile field.
router.post(
  "/:slug/player-profile",
  requireAuth,
  resolveWorldContext,
  requireActiveWorldMembership,
  asyncRoute(async (req, res) => {
    const playerId = String(req.body?.playerId || "");
    if (!mongoose.isValidObjectId(playerId)) {
      return res.status(400).json({
        message: "Choose a valid player profile.",
        code: "WORLD_PLAYER_PROFILE_INVALID",
      });
    }

    const player = await Player.findOne({
      _id: playerId,
      worldId: req.worldId,
    }).select("_id name profileImage position").lean();

    if (!player) {
      return res.status(404).json({
        message: "That player profile does not belong to this World.",
        code: "WORLD_PLAYER_PROFILE_NOT_FOUND",
      });
    }

    const collision = await WorldMembership.exists({
      worldId: req.worldId,
      playerProfileId: player._id,
      userId: { $ne: req.user._id },
    });
    if (collision) {
      return res.status(409).json({
        message: "That player profile is already linked to another account.",
        code: "WORLD_PLAYER_PROFILE_ALREADY_LINKED",
      });
    }

    const membership = await WorldMembership.findOneAndUpdate(
      {
        _id: req.membership._id,
        worldId: req.worldId,
        userId: req.user._id,
        status: "active",
      },
      { $set: { playerProfileId: player._id } },
      { new: true, runValidators: true },
    );

    if (!membership) {
      return res.status(409).json({
        message: "Your World membership changed. Refresh and try again.",
        code: "WORLD_MEMBERSHIP_CONFLICT",
      });
    }

    return res.json({
      message: "Player profile linked to this World.",
      profile: player,
      membership: {
        role: membership.role,
        status: membership.status,
        playerProfileId: membership.playerProfileId,
      },
    });
  }),
);

// A signed-in member has one independent Player profile per World.
// Creating the profile and linking it to the membership is atomic, so a failed
// membership update cannot leave an orphan profile behind.
router.get(
  "/:slug/player-profile",
  requireAuth,
  resolveWorldContext,
  requireActiveWorldMembership,
  asyncRoute(async (req, res) => {
    const playerId = req.membership.playerProfileId;
    if (!playerId) return res.json({ profile: null, needsProfile: true });

    const profile = await Player.findOne({
      _id: playerId,
      worldId: req.worldId,
    })
      .select("_id name profileImage position preferredPositions preferredFoot jerseyNumber bio ovrSnapshot")
      .lean();

    if (!profile) {
      return res.json({
        profile: null,
        needsProfile: true,
        legacyLinkNeedsMigration: true,
      });
    }

    return res.json({ profile, needsProfile: false });
  }),
);

router.post(
  "/:slug/player-profiles",
  requireAuth,
  resolveWorldContext,
  requireActiveWorldMembership,
  asyncRoute(async (req, res) => {
    const allowed = new Set(["name", "position", "preferredFoot", "bio"]);
    const unexpected = Object.keys(req.body || {}).filter(key => !allowed.has(key));
    if (unexpected.length) {
      return res.status(400).json({
        message: "Player profile contains unsupported fields.",
        code: "WORLD_PLAYER_PROFILE_FIELDS_INVALID",
      });
    }

    if (req.membership.playerProfileId) {
      return res.status(409).json({
        message: "You already have a player profile in this World.",
        code: "WORLD_PLAYER_PROFILE_EXISTS",
      });
    }

    const name = String(req.body?.name || "").trim();
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({
        message: "Player name must contain between 2 and 60 characters.",
        code: "WORLD_PLAYER_NAME_INVALID",
      });
    }

    const position = String(req.body?.position || "").trim();
    const preferredFoot = String(req.body?.preferredFoot || "");
    const bio = String(req.body?.bio || "").trim();
    if (!["", "Left", "Right", "Both"].includes(preferredFoot)) {
      return res.status(400).json({
        message: "Choose a valid preferred foot.",
        code: "WORLD_PLAYER_FOOT_INVALID",
      });
    }
    if (bio.length > 500) {
      return res.status(400).json({
        message: "Player bio cannot exceed 500 characters.",
        code: "WORLD_PLAYER_BIO_INVALID",
      });
    }

    const session = await mongoose.startSession();
    let profile;
    try {
      await session.withTransaction(async () => {
        const currentMembership = await WorldMembership.findOne({
          _id: req.membership._id,
          worldId: req.worldId,
          userId: req.user._id,
          status: "active",
          playerProfileId: null,
        }).session(session);

        if (!currentMembership) {
          const error = new Error("A player profile is already linked to this World membership.");
          error.status = 409;
          error.code = "WORLD_PLAYER_PROFILE_EXISTS";
          throw error;
        }

        const normalizedName = name
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLocaleLowerCase("en");

        const duplicate = await Player.findOne({
          worldId: req.worldId,
          nameNormalized: normalizedName,
        }).session(session).select("_id");

        if (duplicate) {
          const error = new Error("A player with that name already exists in this World.");
          error.status = 409;
          error.code = "WORLD_PLAYER_NAME_TAKEN";
          throw error;
        }

        const [created] = await Player.create([{
          worldId: req.worldId,
          name,
          nameNormalized: normalizedName,
          position,
          preferredFoot,
          bio,
        }], { session });

        currentMembership.playerProfileId = created._id;
        await currentMembership.save({ session });
        profile = created;
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          message: "A player with that name already exists in this World.",
          code: "WORLD_PLAYER_NAME_TAKEN",
        });
      }
      if (error?.status) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code,
        });
      }
      throw error;
    } finally {
      await session.endSession();
    }

    return res.status(201).json({
      message: "Your player profile has been created in this World.",
      profile: {
        id: String(profile._id),
        name: profile.name,
        position: profile.position,
        preferredFoot: profile.preferredFoot,
        bio: profile.bio,
      },
    });
  }),
);

// Internal World map. The preview is public, but local facilities are visible
// only to an approved member of that World.
router.get(
  "/:slug/map",
  requireAuth,
  resolveWorldContext,
  requireActiveWorldMembership,
  asyncRoute(async (req, res) => {
    const snapshot = await getWorldMapSnapshot(req.worldId);
    const role = req.membership.role;
    return res.json({
      world: safeWorld(req.world),
      ...snapshot,
      permissions: {
        canEditMap: ["owner", "admin"].includes(role),
      },
    });
  }),
);

router.patch(
  "/:slug/map/facilities/:facilityKey",
  requireAuth,
  resolveWorldContext,
  requireWorldCapability("map:edit"),
  asyncRoute(async (req, res) => {
    const allowed = new Set(["expectedLayoutVersion", "position", "rotation", "appearanceKey"]);
    const unexpected = Object.keys(req.body || {}).filter(key => !allowed.has(key));
    if (unexpected.length) {
      return res.status(400).json({
        message: "Map facility update contains unsupported fields.",
        code: "WORLD_MAP_UPDATE_FIELDS_INVALID",
        requestId: req.requestId || null,
      });
    }

    const result = await moveWorldMapFacility({
      worldId: req.worldId,
      userId: req.user._id,
      facilityKey: req.params.facilityKey,
      expectedLayoutVersion: req.body?.expectedLayoutVersion,
      position: req.body?.position,
      rotation: req.body?.rotation,
      appearanceKey: req.body?.appearanceKey,
    });
    return res.json(result);
  }),
);

// Public World preview. Do not include membership status in this response.
router.get("/:slug", resolveWorldContext, asyncRoute(async (req, res) => {
  return res.json({ world: safeWorld(req.world) });
}));

router.get("/:slug/membership", requireAuth, resolveWorldContext, asyncRoute(async (req, res) => {
  const membership = await accountWorldAccess(req, req.world);
  return res.json({ membership, status: membership.status });
}));

router.use("/:slug/join-requests", requireAuth, resolveWorldContext, (req, res) => res.status(410).json({
  message: "Self-service join requests are disabled. Ask the GG platform administrator to link your verified Gmail address.",
  code: "WORLD_INVITATION_REQUIRED",
}));

export default router;

import express from "express";
import mongoose from "mongoose";

import World from "../models/World.js";
import WorldMembership from "../models/WorldMembership.js";
import { requireAuth } from "../middleware/auth.js";
import { resolveWorldContext } from "../middleware/worldContext.js";
import {
  requireActiveWorldMembership,
  requireWorldCapability,
} from "../middleware/worldPermissions.js";
import { getWorldMapSnapshot, moveWorldMapFacility } from "../services/worldMapLayout.js";
import {
  availableGlobalMapSlots,
  createWorldForUser,
} from "../services/worldCreation.js";

const router = express.Router();

function safeWorld(world, memberCount = 0) {
  return {
    slug: world.slug,
    name: world.name,
    description: world.description || "",
    emblem: String(world.name || "GG").trim().slice(0, 2).toUpperCase(),
    emblemAssetId: world.branding?.emblemAssetId || null,
    accentColor: world.branding?.accentColor || "#c5a45b",
    memberCount,
    globalMap: {
      mapId: world.globalMap?.mapId || "gg-main-v1",
      slotIndex: Number.isSafeInteger(world.globalMap?.slotIndex) ? world.globalMap.slotIndex : null,
      x: world.globalMap?.x,
      y: world.globalMap?.y,
    },
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Public map projection. Viewer membership state is deliberately not included;
// clients load that separately from /me or /:slug/membership.
router.get("/map", asyncRoute(async (req, res) => {
  const [worlds, occupiedWorlds] = await Promise.all([
    World.find({
      visibility: "public",
      status: "active",
      "globalMap.x": { $type: "number" },
      "globalMap.y": { $type: "number" },
    })
      .select("name slug description branding globalMap")
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    World.find({
      status: "active",
      "globalMap.mapId": "gg-main-v1",
      "globalMap.x": { $type: "number" },
      "globalMap.y": { $type: "number" },
    })
      .select("globalMap.x globalMap.y")
      .lean(),
  ]);

  // Plot availability considers every active World even though the public
  // directory projection is capped for payload size.
  const availablePlots = availableGlobalMapSlots(occupiedWorlds, 16);
  if (!worlds.length) return res.json({ worlds: [], availablePlots });

  const worldIds = worlds.map(world => world._id);
  const counts = await WorldMembership.aggregate([
    { $match: { worldId: { $in: worldIds }, status: "active" } },
    { $group: { _id: "$worldId", count: { $sum: 1 } } },
  ]);
  const countByWorld = new Map(counts.map(entry => [String(entry._id), entry.count]));

  return res.json({
    worlds: worlds.map(world => safeWorld(world, countByWorld.get(String(world._id)) || 0)),
    availablePlots,
  });
}));

// The signed-in account's own World list. No other members' account details are
// returned by this endpoint.
router.get("/me", requireAuth, asyncRoute(async (req, res) => {
  const memberships = await WorldMembership.find({
    userId: req.user._id,
    status: { $in: ["active", "pending", "rejected", "suspended"] },
  })
    .sort({ updatedAt: -1, _id: 1 })
    .lean();

  const worlds = await World.find({
    _id: { $in: memberships.map(item => item.worldId) },
    status: { $ne: "archived" },
  })
    .select("name slug description branding globalMap status")
    .lean();

  const worldById = new Map(worlds.map(world => [String(world._id), world]));
  return res.json({
    worlds: memberships
      .map(membership => {
        const world = worldById.get(String(membership.worldId));
        if (!world) return null;
        return {
          ...safeWorld(world),
          membership: {
            role: membership.role,
            status: membership.status,
            playerProfileId: membership.playerProfileId || null,
            requestedAt: membership.requestedAt,
            approvedAt: membership.approvedAt,
          },
        };
      })
      .filter(Boolean),
  });
}));

// Create a public World. Its owner membership, isometric layout and standard
// facilities are created in one MongoDB transaction.
router.post("/", requireAuth, asyncRoute(async (req, res) => {
  const allowed = new Set(["name", "slug", "description", "globalMapSlotIndex"]);
  const unexpected = Object.keys(req.body || {}).filter(key => !allowed.has(key));
  if (unexpected.length) {
    return res.status(400).json({
      message: "World creation contains unsupported fields.",
      code: "WORLD_CREATE_FIELDS_INVALID",
      requestId: req.requestId || null,
    });
  }

  const world = await createWorldForUser({
    user: req.user,
    name: req.body?.name,
    slug: req.body?.slug,
    description: req.body?.description,
    globalMapSlotIndex: req.body?.globalMapSlotIndex ?? null,
  });

  return res.status(201).json({
    world: safeWorld(world, 1),
    membership: {
      role: "owner",
      status: "active",
      playerProfileId: null,
    },
  });
}));

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
  const memberCount = await WorldMembership.countDocuments({
    worldId: req.worldId,
    status: "active",
  });
  return res.json({ world: safeWorld(req.world, memberCount) });
}));

router.get("/:slug/membership", requireAuth, resolveWorldContext, asyncRoute(async (req, res) => {
  const membership = req.membership;
  if (!membership) return res.json({ membership: null, status: "none" });
  return res.json({
    membership: {
      role: membership.role,
      status: membership.status,
      playerProfileId: membership.playerProfileId || null,
      requestedAt: membership.requestedAt,
      approvedAt: membership.approvedAt,
    },
    status: membership.status,
  });
}));

router.post("/:slug/join-requests", requireAuth, resolveWorldContext, asyncRoute(async (req, res) => {
  const current = req.membership;
  if (current?.status === "active") {
    return res.json({
      message: "You are already a member of this World.",
      membership: { status: current.status, role: current.role },
    });
  }
  if (current?.status === "pending") {
    return res.json({
      message: "Your request is already awaiting approval.",
      membership: { status: current.status, role: current.role },
    });
  }
  if (current?.status === "suspended") {
    return res.status(403).json({
      message: "Your membership in this World is suspended.",
      code: "WORLD_MEMBERSHIP_SUSPENDED",
    });
  }

  const now = new Date();
  let membership;
  if (current) {
    membership = await WorldMembership.findOneAndUpdate(
      {
        _id: current._id,
        worldId: req.worldId,
        userId: req.user._id,
        status: { $in: ["rejected", "left"] },
      },
      {
        $set: {
          role: "member",
          status: "pending",
          requestedAt: now,
          approvedAt: null,
          approvedBy: null,
          rejectedAt: null,
          rejectedBy: null,
          decisionNote: "",
        },
      },
      { new: true, runValidators: true },
    );
  } else {
    try {
      membership = await WorldMembership.create({
        worldId: req.worldId,
        userId: req.user._id,
        role: "member",
        status: "pending",
        requestedAt: now,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      membership = await WorldMembership.findOne({
        worldId: req.worldId,
        userId: req.user._id,
      });
    }
  }

  if (!membership) {
    return res.status(409).json({
      message: "The membership request changed. Refresh and try again.",
      code: "WORLD_MEMBERSHIP_CONFLICT",
    });
  }

  return res.status(202).json({
    message: "Your request to join this World has been submitted.",
    membership: { status: membership.status, role: membership.role },
  });
}));

router.get(
  "/:slug/join-requests",
  requireAuth,
  resolveWorldContext,
  requireWorldCapability("membership:review"),
  asyncRoute(async (req, res) => {
    const pending = await WorldMembership.find({
      worldId: req.worldId,
      status: "pending",
    })
      .sort({ requestedAt: 1, _id: 1 })
      .populate({ path: "userId", select: "name profileImage" })
      .lean();

    return res.json({
      requests: pending.map(item => ({
        id: String(item._id),
        user: item.userId
          ? { id: String(item.userId._id), name: item.userId.name, profileImage: item.userId.profileImage || "" }
          : null,
        requestedAt: item.requestedAt,
      })),
    });
  }),
);

router.post(
  "/:slug/join-requests/:membershipId/approve",
  requireAuth,
  resolveWorldContext,
  requireWorldCapability("membership:review"),
  asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.membershipId)) {
      return res.status(400).json({ message: "Invalid membership id.", code: "MEMBERSHIP_ID_INVALID" });
    }

    const now = new Date();
    const membership = await WorldMembership.findOneAndUpdate(
      {
        _id: req.params.membershipId,
        worldId: req.worldId,
        status: "pending",
      },
      {
        $set: {
          role: "member",
          status: "active",
          approvedAt: now,
          approvedBy: req.user._id,
          rejectedAt: null,
          rejectedBy: null,
          decisionNote: "",
        },
      },
      { new: true, runValidators: true },
    );

    if (!membership) {
      return res.status(404).json({
        message: "Pending membership request not found in this World.",
        code: "WORLD_JOIN_REQUEST_NOT_FOUND",
      });
    }

    return res.json({
      message: "World membership approved.",
      membership: {
        id: String(membership._id),
        role: membership.role,
        status: membership.status,
        approvedAt: membership.approvedAt,
      },
    });
  }),
);

router.post(
  "/:slug/join-requests/:membershipId/reject",
  requireAuth,
  resolveWorldContext,
  requireWorldCapability("membership:review"),
  asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.membershipId)) {
      return res.status(400).json({ message: "Invalid membership id.", code: "MEMBERSHIP_ID_INVALID" });
    }

    const decisionNote = String(req.body?.decisionNote || "").trim();
    if (decisionNote.length > 500) {
      return res.status(400).json({ message: "Decision note is too long.", code: "DECISION_NOTE_INVALID" });
    }

    const membership = await WorldMembership.findOneAndUpdate(
      {
        _id: req.params.membershipId,
        worldId: req.worldId,
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
          rejectedAt: new Date(),
          rejectedBy: req.user._id,
          decisionNote,
        },
      },
      { new: true, runValidators: true },
    );

    if (!membership) {
      return res.status(404).json({
        message: "Pending membership request not found in this World.",
        code: "WORLD_JOIN_REQUEST_NOT_FOUND",
      });
    }

    return res.json({
      message: "World membership request rejected.",
      membership: {
        id: String(membership._id),
        role: membership.role,
        status: membership.status,
        rejectedAt: membership.rejectedAt,
      },
    });
  }),
);

export default router;

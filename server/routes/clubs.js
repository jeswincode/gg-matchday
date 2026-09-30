import express from "express";
import mongoose from "mongoose";
import Club from "../models/clubs/Club.js";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubFormationApplication from "../models/clubs/ClubFormationApplication.js";
import Player from "../models/Player.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import {
  CLUB_FORMATIONS,
  CLUB_MAX_MEMBERS,
  CLUB_STARTING_BALANCE,
  normalizeClubName,
  validateClubMemberCount,
  validateFormation,
} from "../config/clubsRules.js";
import { pingClubsDatabase, getClubsConnection } from "../config/clubsDatabase.js";

const router = express.Router();

const FORMATION_ACTIVE_STATUSES = [
  "pendingMutualAgreement",
  "pendingName",
  "pendingCaptainVoteSetup",
  "captainVote",
  "pendingAdminApproval",
];

function ensureClubsDatabase(res) {
  const connection = getClubsConnection();
  if (connection.readyState !== 1) {
    res.status(503).json({
      message: "Clubs database is not connected. Configure CLUBS_MONGODB_URI first.",
    });
    return false;
  }
  return true;
}

function requireLinkedPlayer(req, res) {
  const playerId = req.user?.playerProfile;
  if (!playerId) {
    res.status(403).json({ message: "Link your GG player profile before using Clubs." });
    return null;
  }
  return playerId;
}

async function getActiveContract(playerIds) {
  return ClubContract.findOne({
    playerId: { $in: playerIds },
    status: "active",
  }).lean();
}

async function getFormationConflict(playerIds, exceptId = null) {
  const filter = {
    memberIds: { $in: playerIds },
    status: { $in: FORMATION_ACTIVE_STATUSES },
  };
  if (exceptId) filter._id = { $ne: exceptId };
  return ClubFormationApplication.findOne(filter)
    .select("_id memberIds status proposedName")
    .lean();
}

router.get("/health", async (req, res) => {
  try {
    const connected = await pingClubsDatabase();
    if (!connected) {
      return res.status(503).json({
        success: false,
        status: "degraded",
        database: "clubs-disconnected",
      });
    }
    return res.json({
      success: true,
      status: "ok",
      database: "clubs-connected",
    });
  } catch (error) {
    console.error("Clubs database health check error:", error);
    return res.status(503).json({
      success: false,
      status: "degraded",
      database: "clubs-disconnected",
    });
  }
});

router.get("/meta", (req, res) => {
  res.json({
    clubMaxMembers: CLUB_MAX_MEMBERS,
    clubStartingBalance: CLUB_STARTING_BALANCE,
    formations: CLUB_FORMATIONS,
    activeClubPolicy: "one-active-club-per-player",
    captainPolicy: "top-two-ovr-candidates; four-player vote; tie creates two co-captains",
    bettingPolicy: "club-to-club only; winning club receives the full two-club stake pot",
    playerRewardPolicy: "signing payments and individual club-match awards; betting does not pay players",
    reviewPolicy: "one teammate review and one opponent review per reviewer/reviewed relationship",
  });
});

router.get("/formation/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;

  try {
    const applications = await ClubFormationApplication.find({
      memberIds: playerId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(applications);
  } catch (error) {
    console.error("Load formation applications error:", error);
    return res.status(500).json({
      message: "Failed to load your club formation applications.",
    });
  }
});

router.post("/formation", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const founderPlayerId = requireLinkedPlayer(req, res);
  if (!founderPlayerId) return;

  try {
    const invitedIds = Array.isArray(req.body?.playerIds)
      ? req.body.playerIds
      : [];

    const memberIds = validateClubMemberCount([
      founderPlayerId,
      ...invitedIds,
    ]);

    if (memberIds.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        message: "One or more selected player ids are invalid.",
      });
    }

    if (memberIds.some(id => String(id) === String(founderPlayerId) && invitedIds.length > 0)) {
      return res.status(400).json({
        message: "Choose three different players besides yourself.",
      });
    }

    const [players, activeContract, existingFormation] = await Promise.all([
      Player.find({ _id: { $in: memberIds } }).select("_id name").lean(),
      getActiveContract(memberIds),
      getFormationConflict(memberIds),
    ]);

    if (players.length !== CLUB_MAX_MEMBERS) {
      return res.status(400).json({
        message: "All four selected players must exist in GG Matchday.",
      });
    }

    if (activeContract) {
      return res.status(409).json({
        message: "Every selected player must be outside an active club before formation begins.",
      });
    }

    if (existingFormation) {
      return res.status(409).json({
        message: "One of these players is already involved in an active club formation.",
      });
    }

    const linkedUsers = await User.find({
      playerProfile: { $in: memberIds },
    }).select("playerProfile name email").lean();

    if (linkedUsers.length !== CLUB_MAX_MEMBERS) {
      const linked = new Set(linkedUsers.map(user => String(user.playerProfile)));
      const missingNames = players
        .filter(player => !linked.has(String(player._id)))
        .map(player => player.name);

      return res.status(409).json({
        message: "Every invited player needs a linked GG account before accepting. Missing: " + missingNames.join(", ") + ".",
      });
    }

    const application = await ClubFormationApplication.create({
      founderPlayerId,
      memberIds,
      memberApprovals: memberIds.map(playerId => ({
        playerId,
        status: String(playerId) === String(founderPlayerId) ? "accepted" : "pending",
        respondedAt: String(playerId) === String(founderPlayerId) ? new Date() : null,
      })),
      proposedName: "",
      proposedNameNormalized: "",
      status: "pendingMutualAgreement",
      formation: validateFormation(req.body?.formation || "1-2-1"),
    });

    return res.status(201).json(application);
  } catch (error) {
    console.error("Create club formation error:", error);
    return res.status(400).json({
      message: error.message || "Failed to start club formation.",
    });
  }
});

router.post("/formation/:id/respond", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid formation application id." });
  }

  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: "Club formation application not found." });
    }

    const member = application.memberApprovals.find(
      approval => String(approval.playerId) === String(playerId),
    );

    if (!member) {
      return res.status(403).json({
        message: "You are not part of this club formation.",
      });
    }

    if (application.status !== "pendingMutualAgreement") {
      return res.status(409).json({
        message: "This formation is no longer waiting for member responses.",
      });
    }

    if (String(application.founderPlayerId) === String(playerId)) {
      return res.status(400).json({
        message: "The founder is already marked as accepted.",
      });
    }

    if (member.status !== "pending") {
      return res.status(409).json({
        message: "You have already responded to this invitation.",
      });
    }

    const accepted = req.body?.accept === true;
    member.respondedAt = new Date();

    if (!accepted) {
      member.status = "declined";
      application.status = "rejected";
      application.rejectionReason =
        "A proposed club member declined the formation invitation.";
      await application.save();
      return res.json(application);
    }

    member.status = "accepted";

    if (
      application.memberApprovals.every(
        approval => approval.status === "accepted",
      )
    ) {
      const activeContract = await getActiveContract(application.memberIds);
      if (activeContract) {
        return res.status(409).json({
          message:
            "A selected player entered another club before all invitations were accepted.",
        });
      }
      application.status = "pendingName";
    }

    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Respond to club formation error:", error);
    return res.status(500).json({
      message: "Failed to update the formation invitation.",
    });
  }
});

router.post("/formation/:id/name", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid formation application id." });
  }

  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: "Club formation application not found." });
    }

    if (!application.memberIds.some(id => String(id) === String(playerId))) {
      return res.status(403).json({
        message: "Only club members can propose the club name.",
      });
    }

    if (application.status !== "pendingName") {
      return res.status(409).json({
        message:
          "The club name can only be proposed after all four members accept.",
      });
    }

    if (
      !application.memberApprovals.every(
        approval => approval.status === "accepted",
      )
    ) {
      return res.status(409).json({
        message: "All four members must accept before the club name can be proposed.",
      });
    }

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Club name is required." });
    }

    if (name.length > 80) {
      return res.status(400).json({
        message: "Club name must be 80 characters or fewer.",
      });
    }

    const normalized = normalizeClubName(name);

    const [existingApprovedClub, conflictingApplication] = await Promise.all([
      Club.findOne({ nameNormalized: normalized })
        .select("_id name")
        .lean(),
      ClubFormationApplication.findOne({
        _id: { $ne: application._id },
        proposedNameNormalized: normalized,
        status: { $in: FORMATION_ACTIVE_STATUSES },
      })
        .select("_id proposedName")
        .lean(),
    ]);

    if (existingApprovedClub) {
      return res.status(409).json({
        message: "That club name is already permanently registered.",
      });
    }

    if (conflictingApplication) {
      return res.status(409).json({
        message: "Another active club formation is already using that proposed name.",
      });
    }

    application.proposedName = name;
    application.proposedNameNormalized = normalized;
    application.status = "pendingCaptainVoteSetup";
    await application.save();

    return res.json(application);
  } catch (error) {
    console.error("Propose club name error:", error);
    return res.status(500).json({
      message: "Failed to propose the club name.",
    });
  }
});

router.get("/", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;

  try {
    const clubs = await Club.find({ status: "approved" })
      .sort({ nameNormalized: 1 })
      .lean();
    return res.json(clubs);
  } catch (error) {
    console.error("Error fetching clubs:", error);
    return res.status(500).json({ message: "Failed to fetch clubs." });
  }
});

router.get("/:id", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid club id." });
  }

  try {
    const club = await Club.findOne({
      _id: req.params.id,
      status: "approved",
    }).lean();

    if (!club) {
      return res.status(404).json({ message: "Club not found." });
    }

    return res.json(club);
  } catch (error) {
    console.error("Error fetching club:", error);
    return res.status(500).json({ message: "Failed to fetch club." });
  }
});

export default router;
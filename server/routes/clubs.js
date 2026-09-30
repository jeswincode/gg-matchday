import express from "express";
import mongoose from "mongoose";
import Club from "../models/clubs/Club.js";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubFormationApplication from "../models/clubs/ClubFormationApplication.js";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  CLUB_FORMATIONS,
  CLUB_MAX_MEMBERS,
  CLUB_STARTING_BALANCE,
  normalizeClubName,
  validateClubMemberCount,
  validateFormation,
  nextRenewalBoundary,
  selectCaptainCandidates,
  resolveCaptainVote,
} from "../config/clubsRules.js";
import { pingClubsDatabase, getClubsConnection } from "../config/clubsDatabase.js";
import { calculatePlayerAttributes } from "../services/playerAttributes.js";
import ClubWalletTransaction from "../models/clubs/ClubWalletTransaction.js";
import PlayerWallet from "../models/clubs/PlayerWallet.js";
import ClubHistory from "../models/clubs/ClubHistory.js";
import PlayerReview from "../models/clubs/PlayerReview.js";
import AuctionOffer from "../models/clubs/AuctionOffer.js";
import ClubRenewalDecision from "../models/clubs/ClubRenewalDecision.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import ClubMatchBet from "../models/clubs/ClubMatchBet.js";
import ClubPlayerStats from "../models/clubs/ClubPlayerStats.js";
import JoinRequest from "../models/clubs/JoinRequest.js";
import PlayerWalletTransaction from "../models/clubs/PlayerWalletTransaction.js";
import { settleClubMatchRewards } from "../services/clubsMatchSettlement.js";
import { generateClubMatchPrediction } from "../services/clubsPrediction.js";
import { placeClubMatchBet, settleClubMatchBets } from "../services/clubsBetting.js";
import {
  positiveMoney,
  activeCaptainApprovalComplete,
  validateRetention,
  debitClubWallet,
  creditPlayerWallet,
} from "../services/clubsEconomy.js";

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

async function getUserClubCaptainState(playerId, clubId) {
  const club = await Club.findOne({ _id: clubId, status: "approved" }).lean();
  if (!club) return null;
  const isCaptain = club.captainIds.some(id => String(id) === String(playerId));
  return { club, isCaptain };
}

router.get("/wallet/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const wallet = await PlayerWallet.findOneAndUpdate({ playerId }, { $setOnInsert: { playerId, balance: 0 } }, { upsert: true, new: true }).lean();
  const transactions = await PlayerWalletTransaction.find({ playerId }).sort({ createdAt: -1 }).limit(25).lean();
  return res.json({ wallet, transactions });
});

router.get("/clubs/:clubId/wallet", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const state = await getUserClubCaptainState(req.user?.playerProfile, req.params.clubId);
  if (!state) return res.status(404).json({ message: "Club not found." });
  const transactions = await ClubWalletTransaction.find({ clubId: req.params.clubId }).sort({ createdAt: -1 }).limit(25).lean();
  return res.json({ club: state.club, transactions });
});

router.get("/auction/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;

  try {
    const [ownOffers, captainClubs] = await Promise.all([
      AuctionOffer.find({
        playerId,
        status: { $in: ["active", "chosenByPlayer", "approved"] },
      })
        .sort({ createdAt: -1 })
        .lean(),
      Club.find({
        status: "approved",
        captainIds: playerId,
      })
        .select("_id name balance memberIds captainIds")
        .lean(),
    ]);

    const incomingOffers = await AuctionOffer.find({
      clubId: { $in: captainClubs.map(club => club._id) },
      status: "chosenByPlayer",
    })
      .sort({ createdAt: -1 })
      .lean();

    const playerIds = [
      ...new Set([
        ...ownOffers.map(offer => String(offer.playerId)),
        ...incomingOffers.map(offer => String(offer.playerId)),
      ]),
    ];
    const offeredPlayers = playerIds.length
      ? await Player.find({ _id: { $in: playerIds } })
          .select("_id name position profileImage jerseyNumber")
          .lean()
      : [];

    return res.json({
      ownOffers,
      incomingOffers,
      offeredPlayers,
      captainClubs,
    });
  } catch (error) {
    console.error("Load auction state error:", error);
    return res.status(500).json({ message: "Failed to load your auction state." });
  }
});

router.get("/auction/eligible-players", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const active = await ClubContract.find({ status: "active" }).select("playerId").lean();
  const activeIds = active.map(item => item.playerId);
  const players = await Player.find(activeIds.length ? { _id: { $nin: activeIds } } : {}).select("_id name position profileImage jerseyNumber").sort({ name: 1 }).lean();
  return res.json(players);
});

router.get("/auction/offers/:playerId", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.playerId)) return res.status(400).json({ message: "Invalid player id." });
  const offers = await AuctionOffer.find({ playerId: req.params.playerId, status: { $in: ["active", "chosenByPlayer", "approved"] } }).sort({ amount: -1, createdAt: 1 }).lean();
  return res.json(offers);
});

router.post("/auction/offers", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const clubId = req.body?.clubId;
  const playerId = req.body?.playerId;
  if (!mongoose.isValidObjectId(clubId) || !mongoose.isValidObjectId(playerId)) return res.status(400).json({ message: "Valid club and player ids are required." });
  try {
    const amount = positiveMoney(req.body?.amount);
    const state = await getUserClubCaptainState(req.user.playerProfile, clubId);
    if (!state?.isCaptain) return res.status(403).json({ message: "Only a club captain can make a signing offer." });
    if (state.club.memberIds.length >= CLUB_MAX_MEMBERS) return res.status(409).json({ message: "Your club already has four players." });
    const activeContract = await ClubContract.findOne({ playerId, status: "active" }).lean();
    if (activeContract) return res.status(409).json({ message: "That player is already under an active club contract." });
    if (state.club.balance < amount) return res.status(409).json({ message: "Your club does not have enough balance for that offer." });
    const offer = await AuctionOffer.create({ clubId, playerId, amount, status: "active" });
    return res.status(201).json(offer);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to create signing offer." });
  }
});

router.post("/auction/offers/:offerId/choose", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.offerId)) return res.status(400).json({ message: "Invalid offer id." });
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const offer = await AuctionOffer.findById(req.params.offerId);
    if (!offer) return res.status(404).json({ message: "Offer not found." });
    if (String(offer.playerId) !== String(playerId)) return res.status(403).json({ message: "Only the offered player can choose this offer." });
    if (offer.status !== "active") return res.status(409).json({ message: "This offer is no longer active." });
    if (offer.expiresAt && offer.expiresAt <= new Date()) return res.status(409).json({ message: "This offer has expired." });
    const activeContract = await ClubContract.findOne({ playerId, status: "active" }).lean();
    if (activeContract) return res.status(409).json({ message: "You must be outside an active club contract to sign." });
    offer.status = "chosenByPlayer";
    offer.playerChosenAt = new Date();
    await AuctionOffer.updateMany({ playerId, _id: { $ne: offer._id }, status: "active" }, { $set: { status: "rejectedByPlayer" } });
    await offer.save();
    return res.json(offer);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to choose the signing offer." });
  }
});

router.post("/auction/offers/:offerId/approve", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.offerId)) return res.status(400).json({ message: "Invalid offer id." });
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const connection = getClubsConnection();
  const session = await connection.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const offer = await AuctionOffer.findById(req.params.offerId).session(session);
      if (!offer) throw new Error("Offer not found.");
      if (!["chosenByPlayer"].includes(offer.status)) throw new Error("The player must choose this offer before captain approval.");
      const club = await Club.findOne({ _id: offer.clubId, status: "approved" }).session(session);
      if (!club) throw new Error("Club not found.");
      if (!club.captainIds.some(id => String(id) === String(playerId))) throw new Error("Only an elected captain can approve the signing.");
      if (club.memberIds.length >= CLUB_MAX_MEMBERS) throw new Error("The club already has four players.");
      const activeContract = await ClubContract.findOne({ playerId: offer.playerId, status: "active" }).session(session);
      if (activeContract) throw new Error("That player is already in an active club.");
      if (club.balance < offer.amount) throw new Error("The club does not have enough balance.");
      if (!activeCaptainApprovalComplete(club.captainIds, [...offer.captainApprovalIds, playerId])) throw new Error("All club captains must approve this signing.");
      const now = new Date();
      const endAt = nextRenewalBoundary(now);
      const updatedClub = await Club.findOneAndUpdate(
        { _id: club._id, status: "approved", memberIds: { $not: { $size: CLUB_MAX_MEMBERS } } },
        { $push: { memberIds: offer.playerId } },
        { new: true, session },
      );
      if (!updatedClub) throw new Error("The club changed before this signing could be completed.");
      const debitedClub = await debitClubWallet({
        clubId: club._id,
        amount: offer.amount,
        type: "auction_purchase",
        description: "Player signing payment.",
        session,
        refs: { auctionOfferId: offer._id },
        idempotencyKey: "auction:" + offer._id,
      });
      await creditPlayerWallet({
        playerId: offer.playerId,
        amount: offer.amount,
        type: "signing_payment",
        description: "Club signing payment.",
        session,
        refs: { clubId: club._id, auctionOfferId: offer._id },
        idempotencyKey: "auction:" + offer._id,
      });
      await ClubContract.create([{ clubId: club._id, playerId: offer.playerId, startAt: now, endAt, signingAmount: offer.amount, source: "auction", renewalNumber: 0 }], { session });
      await ClubHistory.create([{ clubId: club._id, playerId: offer.playerId, eventType: "memberJoined", description: "Player joined the club through a signing offer.", metadata: { auctionOfferId: offer._id, signingAmount: offer.amount } }], { session });
      offer.captainApprovalIds = [...new Set([...offer.captainApprovalIds.map(String), String(playerId)])];
      offer.captainApprovedAt = now;
      offer.status = "approved";
      await offer.save({ session });
      result = { offer, club: debitedClub };
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to approve the signing." });
  } finally {
    await session.endSession();
  }
});

router.get("/join-requests/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const requests = await JoinRequest.find({
    $or: [{ playerId }, { clubId: { $in: (await Club.find({ memberIds: playerId }).select("_id").lean()).map(c => c._id) } }],
    status: "pending",
  }).sort({ createdAt: -1 }).lean();
  return res.json(requests);
});

router.post("/join-requests", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const clubId = req.body?.clubId;
  if (!mongoose.isValidObjectId(clubId)) return res.status(400).json({ message: "Valid club id is required." });
  try {
    const club = await Club.findOne({ _id: clubId, status: "approved" }).lean();
    if (!club) return res.status(404).json({ message: "Club not found." });
    if (club.memberIds.some(id => String(id) === String(playerId))) return res.status(409).json({ message: "You are already in this club." });
    if (club.memberIds.length >= CLUB_MAX_MEMBERS) return res.status(409).json({ message: "That club currently has four players." });
    const activeContract = await ClubContract.findOne({ playerId, status: "active" }).lean();
    if (activeContract) return res.status(409).json({ message: "You can join another club only after your current contract ends." });
    const pending = await JoinRequest.findOne({ playerId, clubId, status: "pending" }).lean();
    if (pending) return res.status(409).json({ message: "You already have a pending join request for this club." });
    const request = await JoinRequest.create({ playerId, clubId, status: "pending", effectiveStartAt: new Date() });
    return res.status(201).json(request);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to send join request." });
  }
});

router.post("/join-requests/:requestId/respond", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const captainId = requireLinkedPlayer(req, res);
  if (!captainId) return;
  if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ message: "Invalid join request id." });
  const session = await getClubsConnection().startSession();
  try {
    let response;
    await session.withTransaction(async () => {
      const request = await JoinRequest.findById(req.params.requestId).session(session);
      if (!request) throw new Error("Join request not found.");
      if (request.status !== "pending") throw new Error("This join request is no longer pending.");
      const club = await Club.findOne({ _id: request.clubId, status: "approved" }).session(session);
      if (!club) throw new Error("Club not found.");
      if (!club.captainIds.some(id => String(id) === String(captainId))) throw new Error("Only a club captain can approve or reject join requests.");
      if (req.body?.accept !== true) {
        request.status = "rejected";
        request.rejectionReason = String(req.body?.reason || "The club declined the join request.").trim().slice(0, 500);
        await request.save({ session });
        response = { request, club };
        return;
      }
      if (club.memberIds.length >= CLUB_MAX_MEMBERS) throw new Error("The club already has four players.");
      const activeContract = await ClubContract.findOne({ playerId: request.playerId, status: "active" }).session(session);
      if (activeContract) throw new Error("That player already has an active club contract.");
      request.captainApprovalIds = [...new Set([...request.captainApprovalIds.map(String), String(captainId)])];
      if (!activeCaptainApprovalComplete(club.captainIds, request.captainApprovalIds)) {
        await request.save({ session });
        response = { request, club, pendingCaptainApproval: true };
        return;
      }
      const now = new Date();
      const startAt = now;
      const endAt = nextRenewalBoundary(now);
      const updatedClub = await Club.findOneAndUpdate(
        { _id: club._id, status: "approved", memberIds: { $not: { $elemMatch: { $eq: request.playerId } } } },
        { $push: { memberIds: request.playerId } },
        { new: true, session },
      );
      if (!updatedClub) throw new Error("The club changed before the player could join.");
      await ClubContract.create([{
        clubId: club._id,
        playerId: request.playerId,
        startAt,
        endAt,
        signingAmount: 0,
        source: "joinRequest",
        renewalNumber: 0,
      }], { session });
      request.status = "approved";
      request.effectiveStartAt = startAt;
      await request.save({ session });
      await ClubHistory.create([{
        clubId: club._id,
        playerId: request.playerId,
        eventType: "memberJoined",
        description: "Player joined the club through an approved join request.",
      }], { session });
      response = { request, club: updatedClub, pendingCaptainApproval: false };
    });
    return res.json(response);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to respond to join request." });
  } finally {
    await session.endSession();
  }
});

router.get("/clubs/:clubId/renewal", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const club = await Club.findOne({ _id: req.params.clubId, status: "approved" })
      .select("_id name memberIds captainIds")
      .lean();
    if (!club) return res.status(404).json({ message: "Club not found." });
    if (!club.memberIds.some(id => String(id) === String(playerId))) {
      return res.status(403).json({ message: "You are not a member of this club." });
    }
    const contracts = await ClubContract.find({ clubId: club._id, status: "active" })
      .sort({ endAt: 1 })
      .lean();
    const boundaryAt = contracts[0]?.endAt || null;
    const decision = boundaryAt
      ? await ClubRenewalDecision.findOne({ clubId: club._id, boundaryAt }).lean()
      : null;
    return res.json({ club, contracts, boundaryAt, decision, isCaptain: club.captainIds.some(id => String(id) === String(playerId)) });
  } catch (error) {
    console.error("Load club renewal state error:", error);
    return res.status(500).json({ message: "Failed to load club renewal state." });
  }
});

router.post("/clubs/:clubId/renewal", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const clubId = req.params.clubId;
  try {
    const state = await getUserClubCaptainState(playerId, clubId);
    if (!state?.isCaptain) return res.status(403).json({ message: "Only club captains can decide renewals." });
    if (state.club.memberIds.length !== CLUB_MAX_MEMBERS) return res.status(409).json({ message: "Renewal requires a four-player club." });
    const retained = validateRetention(state.club.memberIds, req.body?.retainedPlayerIds, state.club.captainIds);
    const activeContracts = await ClubContract.find({ clubId, status: "active" }).sort({ endAt: 1 }).lean();
    if (activeContracts.length !== CLUB_MAX_MEMBERS) return res.status(409).json({ message: "The club does not have four active contracts to renew." });
    const boundaryAt = activeContracts[0].endAt;
    if (new Date() < new Date(boundaryAt)) return res.status(409).json({ message: "This club's renewal boundary has not arrived yet." });
    let decision = await ClubRenewalDecision.findOne({ clubId, boundaryAt });
    if (!decision) {
      decision = await ClubRenewalDecision.create({ clubId, boundaryAt, retainedPlayerIds: retained, captainApprovalIds: [playerId] });
    } else {
      if (JSON.stringify(decision.retainedPlayerIds.map(String).sort()) !== JSON.stringify(retained.map(String).sort())) return res.status(409).json({ message: "Both captains must approve the same retained players." });
      decision.captainApprovalIds = [...new Set([...decision.captainApprovalIds.map(String), String(playerId)])];
      await decision.save();
    }
    if (!activeCaptainApprovalComplete(state.club.captainIds, decision.captainApprovalIds)) return res.json({ status: decision.status, decision });
    const connection = getClubsConnection();
    const session = await connection.startSession();
    try {
      let updated;
      await session.withTransaction(async () => {
        const club = await Club.findById(clubId).session(session);
        if (!club) throw new Error("Club not found.");
        const contracts = await ClubContract.find({ clubId, status: "active" }).session(session);
        const retainedSet = new Set(retained);
        for (const contract of contracts) {
          contract.status = retainedSet.has(String(contract.playerId)) ? "expired" : "released";
          await contract.save({ session });
        }
        const nextEnd = new Date(Date.UTC(boundaryAt.getUTCFullYear(), boundaryAt.getUTCMonth() + 2, 1));
        const newContracts = [];
        for (const retainedId of retained) newContracts.push({ clubId, playerId: retainedId, startAt: boundaryAt, endAt: nextEnd, signingAmount: 0, source: "renewal", renewalNumber: (contracts.find(c=>String(c.playerId)===String(retainedId))?.renewalNumber||0)+1 });
        await ClubContract.create(newContracts, { session });
        club.memberIds = retained;
        club.captainIds = club.captainIds.filter(id => retainedSet.has(String(id)));
        if (!club.captainIds.length) throw new Error("At least one captain must remain for renewal.");
        await club.save({ session });
        for (const releasedId of contracts.filter(c => !retainedSet.has(String(c.playerId))).map(c=>c.playerId)) await ClubHistory.create([{ clubId, playerId: releasedId, eventType: "memberReleased", description: "Player released at contract renewal." }], { session });
        await ClubHistory.create([{ clubId, eventType: "formationChanged", description: "Club roster renewed with two retained players.", metadata: { boundaryAt, retainedPlayerIds: retained } }], { session });
        decision.status = "applied";
        decision.appliedAt = new Date();
        await decision.save({ session });
        updated = club;
      });
      return res.json({ status: "applied", club: updated, decision });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to apply club renewal." });
  }
});

router.post("/matches/:matchId/settle", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });
  const session = await getClubsConnection().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await settleClubMatchRewards({ clubMatchId: req.params.matchId, session });
      await settleClubMatchBets({ clubMatchId: req.params.matchId, session });
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to settle Club Match economy." });
  } finally {
    await session.endSession();
  }
});

router.get("/reviews/eligible/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const clubMatches = await ClubMatch.find({ status: "completed", mainMatchId: { $ne: null } })
      .select("_id clubAId clubBId mainMatchId")
      .lean();
    const mainMatchIds = clubMatches.map(item => item.mainMatchId);
    if (!mainMatchIds.length) return res.json([]);

    const matches = await Match.find({
      _id: { $in: mainMatchIds },
      "participants.player": playerId,
    }).select("_id participants date").lean();

    const candidateMap = new Map();
    for (const match of matches) {
      const reviewer = match.participants.find(p => String(p.player) === String(playerId));
      if (!reviewer) continue;
      const clubMatch = clubMatches.find(item => String(item.mainMatchId) === String(match._id));
      if (!clubMatch) continue;
      for (const participant of match.participants) {
        const targetId = String(participant.player);
        if (targetId === String(playerId)) continue;
        const relationship = participant.team === reviewer.team ? "teammate" : "opponent";
        const clubId = relationship === "teammate"
          ? (reviewer.team === "A" ? clubMatch.clubAId : clubMatch.clubBId)
          : null;
        const key = targetId + ":" + relationship;
        const current = candidateMap.get(key) || {
          playerId: participant.player,
          relationship,
          clubId,
          matchCount: 0,
        };
        current.matchCount += 1;
        candidateMap.set(key, current);
      }
    }

    const candidates = [...candidateMap.values()];
    const existing = candidates.length
      ? await PlayerReview.find({
          reviewerPlayerId: playerId,
          $or: candidates.map(candidate => ({
            reviewedPlayerId: candidate.playerId,
            relationship: candidate.relationship,
          })),
        }).select("reviewedPlayerId relationship").lean()
      : [];
    const existingKeys = new Set(existing.map(item => String(item.reviewedPlayerId) + ":" + item.relationship));
    const playerIds = [...new Set(candidates.map(candidate => String(candidate.playerId)))];
    const players = playerIds.length
      ? await Player.find({ _id: { $in: playerIds } }).select("_id name profileImage position").lean()
      : [];
    const playerMap = new Map(players.map(player => [String(player._id), player]));
    return res.json(candidates
      .filter(candidate => !existingKeys.has(String(candidate.playerId) + ":" + candidate.relationship))
      .map(candidate => ({ ...candidate, player: playerMap.get(String(candidate.playerId)) || null })));
  } catch {
    return res.status(500).json({ message: "Failed to load eligible reviews." });
  }
});

router.get("/reviews/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const reviews = await PlayerReview.find({ reviewerPlayerId: playerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reviewedPlayerId", "name profileImage position")
      .lean();
    return res.json(reviews);
  } catch {
    return res.status(500).json({ message: "Failed to load your reviews." });
  }
});

router.get("/reviews/player/:playerId", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.playerId)) return res.status(400).json({ message: "Invalid player id." });
  try {
    const reviews = await PlayerReview.find({ reviewedPlayerId: req.params.playerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reviewerPlayerId", "name profileImage position")
      .lean();
    return res.json(reviews);
  } catch {
    return res.status(500).json({ message: "Failed to load player reviews." });
  }
});

router.post("/reviews", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const reviewerPlayerId = requireLinkedPlayer(req, res);
  if (!reviewerPlayerId) return;
  const reviewedPlayerId = req.body?.reviewedPlayerId;
  const stars = Number(req.body?.stars);
  const observation = String(req.body?.observation || "").trim();
  if (!mongoose.isValidObjectId(reviewedPlayerId)) return res.status(400).json({ message: "Choose a valid player to review." });
  if (String(reviewerPlayerId) === String(reviewedPlayerId)) return res.status(400).json({ message: "You cannot review yourself." });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ message: "Stars must be a whole number from 1 to 5." });
  if (!observation || observation.length > 1000) return res.status(400).json({ message: "Write an observation between 1 and 1000 characters." });

  try {
    const reviewerMatches = await ClubMatch.find({ status: "completed", mainMatchId: { $ne: null } })
      .select("_id clubAId clubBId mainMatchId")
      .lean();
    const mainMatchIds = reviewerMatches.map(match => match.mainMatchId);
    if (!mainMatchIds.length) return res.status(403).json({ message: "You have no completed Club Matches eligible for reviews." });

    const mainMatches = await Match.find({
      _id: { $in: mainMatchIds },
      "participants.player": { $all: [reviewerPlayerId, reviewedPlayerId] },
    }).select("_id participants date").lean();

    const eligibleRelationships = new Map();
    for (const mainMatch of mainMatches) {
      const reviewer = mainMatch.participants.find(p => String(p.player) === String(reviewerPlayerId));
      const reviewed = mainMatch.participants.find(p => String(p.player) === String(reviewedPlayerId));
      if (!reviewer || !reviewed) continue;
      const clubMatch = reviewerMatches.find(item => String(item.mainMatchId) === String(mainMatch._id));
      if (!clubMatch) continue;
      const relationship = reviewer.team === reviewed.team ? "teammate" : "opponent";
      const clubId = relationship === "teammate"
        ? (reviewer.team === "A" ? clubMatch.clubAId : clubMatch.clubBId)
        : null;
      const current = eligibleRelationships.get(relationship) || { clubId, count: 0 };
      current.count += 1;
      eligibleRelationships.set(relationship, current);
    }
    if (!eligibleRelationships.size) {
      return res.status(403).json({ message: "You may review only players you have actually played with or against in a completed Club Match." });
    }

    const relationship = String(req.body?.relationship || "");
    if (!["teammate", "opponent"].includes(relationship) || !eligibleRelationships.has(relationship)) {
      return res.status(403).json({ message: "Choose a relationship you have actually established in a completed Club Match." });
    }
    const eligibility = eligibleRelationships.get(relationship);
    const existing = await PlayerReview.findOne({ reviewerPlayerId, reviewedPlayerId, relationship });
    if (existing) return res.status(409).json({ message: "You have already submitted this type of review for this player." });

    const review = await PlayerReview.create({
      reviewerPlayerId,
      reviewedPlayerId,
      relationship,
      stars,
      observation,
      clubId: eligibility.clubId,
      eligibilityMatchCount: eligibility.count,
    });
    return res.status(201).json(review);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "You have already submitted this type of review for this player." });
    return res.status(400).json({ message: error.message || "Failed to submit review." });
  }
});

router.get("/matches/:matchId/prediction", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });
  try {
    const prediction = await generateClubMatchPrediction(req.params.matchId);
    return res.json(prediction);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to generate prediction." });
  }
});

router.get("/matches/:matchId/bets/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });
  const bet = await ClubMatchBet.findOne({ clubMatchId: req.params.matchId, playerId }).lean();
  return res.json(bet || null);
});

router.post("/matches/:matchId/bets", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.matchId) || !mongoose.isValidObjectId(req.body?.clubId)) {
    return res.status(400).json({ message: "Invalid betting details." });
  }
  const session = await getClubsConnection().startSession();
  try {
    let bet;
    await session.withTransaction(async () => {
      bet = await placeClubMatchBet({
        clubMatchId: req.params.matchId,
        playerId,
        clubId: req.body.clubId,
        stake: req.body.stake,
        session,
      });
    });
    return res.status(201).json(bet);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to place Club Match bet." });
  } finally {
    await session.endSession();
  }
});

router.post("/matches/:matchId/bets/settle", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });
  const session = await getClubsConnection().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await settleClubMatchBets({ clubMatchId: req.params.matchId, session });
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to settle Club Match bets." });
  } finally {
    await session.endSession();
  }
});

router.get("/matches", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const filter = {};
    if (req.query.clubId !== undefined) {
      if (!mongoose.isValidObjectId(req.query.clubId)) {
        return res.status(400).json({ message: "Invalid club id." });
      }
      filter.$or = [{ clubAId: req.query.clubId }, { clubBId: req.query.clubId }];
    }
    const matches = await ClubMatch.find(filter)
      .sort({ scheduledAt: -1, createdAt: -1 })
      .limit(100)
      .lean();
    return res.json(matches);
  } catch (error) {
    console.error("Load club matches error:", error);
    return res.status(500).json({ message: "Failed to load club matches." });
  }
});

router.post("/matches", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const { clubAId, clubBId, scheduledAt } = req.body || {};

  if (!mongoose.isValidObjectId(clubAId) || !mongoose.isValidObjectId(clubBId) || String(clubAId) === String(clubBId)) {
    return res.status(400).json({ message: "Choose two different valid clubs." });
  }

  try {
    const requestedClub = await Club.findOne({ _id: clubAId, status: "approved" }).lean();
    const receivingClub = await Club.findOne({ _id: clubBId, status: "approved" }).lean();
    if (!requestedClub || !receivingClub) return res.status(404).json({ message: "Both clubs must exist and be approved." });

    if (!requestedClub.memberIds.some(id => String(id) === String(playerId)) || !requestedClub.captainIds.some(id => String(id) === String(playerId))) {
      return res.status(403).json({ message: "Only a captain of the requesting club can schedule a club match." });
    }

    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({ message: "Choose a valid future match date." });
    }

    const match = await ClubMatch.create({
      clubAId,
      clubBId,
      requestedByClubId: clubAId,
      scheduledAt: date,
      status: "requested",
    });
    return res.status(201).json(match);
  } catch (error) {
    console.error("Create club match request error:", error);
    return res.status(400).json({ message: error.message || "Failed to request the club match." });
  }
});

router.post("/matches/:matchId/respond", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });

  try {
    const match = await ClubMatch.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: "Club match not found." });
    if (match.status !== "requested") return res.status(409).json({ message: "This club match is no longer awaiting a response." });

    const accept = req.body?.accept;
    if (typeof accept !== "boolean") {
      return res.status(400).json({ message: "Respond with accept=true or accept=false." });
    }

    const receivingClub = await Club.findOne({ _id: match.clubBId, status: "approved" }).lean();
    if (!receivingClub) return res.status(404).json({ message: "Receiving club not found." });
    if (!receivingClub.captainIds.some(id => String(id) === String(playerId))) {
      return res.status(403).json({ message: "Only a captain of the receiving club can respond." });
    }

    const captainIds = receivingClub.captainIds.map(String);
    const decision = accept ? "accept" : "decline";
    const response = match.captainResponses.find(item => String(item.captainId) === String(playerId));
    if (response) response.decision = decision;
    else match.captainResponses.push({ captainId: playerId, decision });

    const captainResponses = match.captainResponses.filter(item => captainIds.includes(String(item.captainId)));
    const anyDecline = captainResponses.some(item => item.decision === "decline");
    const allCaptainsResponded = captainIds.every(id => captainResponses.some(item => String(item.captainId) === id));
    const allAgreed = allCaptainsResponded && new Set(captainResponses.map(item => item.decision)).size === 1;

    if (anyDecline) {
      match.status = "declined";
      match.responseDecision = "decline";
    } else if (captainIds.length === 1 || allAgreed) {
      match.status = "accepted";
      match.responseDecision = "accept";
    } else {
      match.status = "requested";
      match.responseDecision = null;
    }

    await match.save();
    return res.json(match);
  } catch (error) {
    console.error("Respond to club match error:", error);
    return res.status(400).json({ message: error.message || "Failed to respond to club match." });
  }
});

router.post("/matches/:matchId/cancel", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });

  try {
    const match = await ClubMatch.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: "Club match not found." });
    const requestingClub = await Club.findOne({ _id: match.requestedByClubId, status: "approved" }).lean();
    if (!requestingClub?.captainIds.some(id => String(id) === String(playerId))) {
      return res.status(403).json({ message: "Only a captain of the requesting club can cancel this match." });
    }
    if (!["requested", "accepted"].includes(match.status)) return res.status(409).json({ message: "This club match cannot be cancelled now." });
    match.status = "cancelled";
    await match.save();
    return res.json(match);
  } catch (error) {
    console.error("Cancel club match error:", error);
    return res.status(400).json({ message: error.message || "Failed to cancel club match." });
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

router.get("/:clubId/stats", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.clubId)) return res.status(400).json({ message: "Invalid club id." });

  try {
    const club = await Club.findOne({ _id: req.params.clubId, status: "approved" })
      .select("_id name formation memberIds captainIds balance")
      .lean();
    if (!club) return res.status(404).json({ message: "Club not found." });

    const stats = await ClubPlayerStats.find({ clubId: club._id })
      .populate("playerId", "name profileImage position")
      .sort({ matches: -1, ratingTotal: -1 })
      .lean();

    return res.json({ club, stats });
  } catch (error) {
    console.error("Load club player stats error:", error);
    return res.status(500).json({ message: "Failed to load club player stats." });
  }
});

router.get("/:clubId/history", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.clubId)) return res.status(400).json({ message: "Invalid club id." });

  try {
    const clubExists = await Club.exists({ _id: req.params.clubId, status: "approved" });
    if (!clubExists) return res.status(404).json({ message: "Club not found." });

    const history = await ClubHistory.find({ clubId: req.params.clubId })
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return res.json(history);
  } catch (error) {
    console.error("Load club history error:", error);
    return res.status(500).json({ message: "Failed to load club history." });
  }
});

router.get("/player/history/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;

  try {
    const [history, contracts] = await Promise.all([
      ClubHistory.find({ playerId }).sort({ occurredAt: -1, createdAt: -1 }).limit(100).lean(),
      ClubContract.find({ playerId }).sort({ startAt: -1 }).lean(),
    ]);
    return res.json({ history, contracts });
  } catch (error) {
    console.error("Load player Club history error:", error);
    return res.status(500).json({ message: "Failed to load your Club history." });
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


async function calculateClubOVRs(memberIds) {
  const players = await Player.find({ _id: { $in: memberIds } }).select("_id position").lean();
  const matches = await Match.find({ "participants.player": { $in: memberIds } }).lean();
  const result = new Map();
  for (const player of players) {
    const data = calculatePlayerAttributes(player, matches);
    result.set(String(player._id), data.ovr);
  }
  return result;
}

router.post("/formation/:id/captain/setup", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Club formation application not found." });
    if (!application.memberIds.some(id => String(id) === String(playerId))) return res.status(403).json({ message: "Only club members can start the captain vote." });
    if (application.status !== "pendingCaptainVoteSetup") return res.status(409).json({ message: "The captain vote is not ready to be started." });
    const ovrByPlayerId = await calculateClubOVRs(application.memberIds);
    const candidates = selectCaptainCandidates(application.memberIds, ovrByPlayerId);
    application.captainCandidates = candidates;
    application.captainVotes = [];
    application.status = "captainVote";
    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Captain vote setup error:", error);
    return res.status(500).json({ message: "Failed to prepare the captain vote." });
  }
});

router.post("/formation/:id/captain/vote", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Club formation application not found." });
    if (application.status !== "captainVote") return res.status(409).json({ message: "The captain vote is not active." });
    if (!application.memberIds.some(id => String(id) === String(playerId))) return res.status(403).json({ message: "Only the four club members can vote." });
    const candidatePlayerId = String(req.body?.candidatePlayerId || "");
    if (!application.captainCandidates.some(id => String(id) === candidatePlayerId)) return res.status(400).json({ message: "Vote for one of the two eligible captain candidates." });
    if (application.captainVotes.some(v => String(v.voterPlayerId) === String(playerId))) return res.status(409).json({ message: "You have already voted." });
    application.captainVotes.push({ voterPlayerId: playerId, candidatePlayerId });
    if (application.captainVotes.length === CLUB_MAX_MEMBERS) {
      const elected = resolveCaptainVote(application.captainCandidates, application.captainVotes);
      application.electedCaptainIds = elected;
      application.status = "pendingAdminApproval";
    }
    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Captain vote error:", error);
    return res.status(500).json({ message: "Failed to record the captain vote." });
  }
});

router.post("/formation/:id/details", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Club formation application not found." });
    if (application.status !== "pendingAdminApproval") return res.status(409).json({ message: "Captain voting must be completed before club details are submitted." });
    if (!application.electedCaptainIds.some(id => String(id) === String(playerId))) return res.status(403).json({ message: "Only the elected captain(s) can submit club details." });
    if (application.electedCaptainIds.length === 2 && application.detailsApprovedBy?.some(id => String(id) === String(playerId))) return res.status(409).json({ message: "You have already approved these club details." });
    const details = String(req.body?.details || "").trim();
    const formation = validateFormation(req.body?.formation || application.formation);
    application.details = details;
    application.formation = formation;
    application.detailsApprovedBy = [...new Set([...(application.detailsApprovedBy || []).map(String), String(playerId)])];
    if (application.electedCaptainIds.every(id => application.detailsApprovedBy.some(approved => String(approved) === String(id)))) {
      application.status = "pendingAdminApproval";
    }
    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Club details submission error:", error);
    return res.status(400).json({ message: error.message || "Failed to save club details." });
  }
});

router.post("/formation/:id/resubmit", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Club formation application not found." });
    if (!application.memberIds.some(id => String(id) === String(playerId))) return res.status(403).json({ message: "Only club members can resubmit this application." });
    if (application.status !== "rejected") return res.status(409).json({ message: "Only rejected applications can be resubmitted." });
    application.status = "pendingAdminApproval";
    application.rejectionReason = "";
    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Club resubmission error:", error);
    return res.status(500).json({ message: "Failed to resubmit the club application." });
  }
});

router.get("/admin/applications", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const applications = await ClubFormationApplication.find({ status: "pendingAdminApproval" }).sort({ createdAt: 1 }).lean();
  return res.json(applications);
});

router.post("/admin/applications/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Club formation application not found." });
    if (application.status !== "pendingAdminApproval") return res.status(409).json({ message: "Only pending applications can be rejected." });
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A rejection reason is required." });
    application.rejectionReason = reason;
    application.status = "rejected";
    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Club application rejection error:", error);
    return res.status(500).json({ message: "Failed to reject the club application." });
  }
});

router.post("/admin/applications/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const session = await getClubsConnection().startSession();
  try {
    let createdClub;
    await session.withTransaction(async () => {
      const application = await ClubFormationApplication.findById(req.params.id).session(session);
      if (!application) throw new Error("Club formation application not found.");
      if (application.status !== "pendingAdminApproval") throw new Error("Only pending applications can be approved.");
      if (application.electedCaptainIds.length < 1) throw new Error("The club must have at least one elected captain.");
      const activeContracts = await ClubContract.find({ playerId: { $in: application.memberIds }, status: "active" }).session(session);
      if (activeContracts.length) throw new Error("A selected player is already in an active club.");
      const normalized = normalizeClubName(application.proposedName);
      const duplicate = await Club.findOne({ nameNormalized: normalized }).session(session);
      if (duplicate) throw new Error("That club name is already permanently registered.");
      const now = new Date();
      const endAt = nextRenewalBoundary(now);
      const [club] = await Club.create([{
        name: application.proposedName,
        nameNormalized: normalized,
        description: application.details,
        formation: application.formation,
        memberIds: application.memberIds,
        captainIds: application.electedCaptainIds,
        balance: CLUB_STARTING_BALANCE,
        status: "approved",
        approvedAt: now,
      }], { session });
      for (const playerId of application.memberIds) {
        await ClubContract.create([{ clubId: club._id, playerId, startAt: now, endAt, signingAmount: 0, source: "formation", renewalNumber: 0 }], { session });
        await PlayerWallet.updateOne({ playerId }, { $setOnInsert: { playerId, balance: 0 } }, { upsert: true, session });
      }
      await ClubWalletTransaction.create([{ clubId: club._id, type: "starting_balance", amount: CLUB_STARTING_BALANCE, balanceAfter: CLUB_STARTING_BALANCE, description: "Club starting balance." }], { session });
      await ClubHistory.create([{ clubId: club._id, eventType: "formed", description: "Club approved and officially formed.", metadata: { formationApplicationId: application._id } }, { clubId: club._id, eventType: "adminApproved", description: "Club application approved by admin." }], { session });
      application.status = "approved";
      application.approvedClubId = club._id;
      application.rejectionReason = "";
      await application.save({ session });
      createdClub = club;
    });
    return res.status(201).json(createdClub);
  } catch (error) {
    console.error("Club application approval error:", error);
    return res.status(400).json({ message: error.message || "Failed to approve the club application." });
  } finally {
    await session.endSession();
  }
});

export default router;
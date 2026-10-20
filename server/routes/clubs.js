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
  CLUB_FORMATIONS_4,
  CLUB_FORMATIONS_5,
  CLUB_MIN_MEMBERS,
  CLUB_MAX_MEMBERS,
  CLUB_STARTING_BALANCE,
  normalizeClubName,
  validateClubMemberCount,
  nextRenewalBoundary,
  selectCaptainCandidates,
  auctionOfferExpiry,
  validateAuctionBid,
  clubMatchRequestExpiry,
  normalizeFixtureDate,
  clubDateKey,
  clubDateStartUtc,
  resolveCaptainVote,
} from "../config/clubsRules.js";
import { pingClubsDatabase, getClubsConnection } from "../config/clubsDatabase.js";
import { calculatePlayerAttributes } from "../services/playerAttributes.js";
import { effectiveMatchRating } from "../services/ratings/index.js";
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
import ClubSyncJob from "../models/ClubSyncJob.js";
import ClubAdminAuditEvent from "../models/clubs/ClubAdminAuditEvent.js";
import { processClubSyncJob } from "../services/clubsSync.js";
import PlayerWalletTransaction from "../models/clubs/PlayerWalletTransaction.js";
import { settleClubMatchRewards } from "../services/clubsMatchSettlement.js";
import { generateClubMatchPrediction } from "../services/clubsPrediction.js";
import { buildPlayerClubAnalytics } from "../services/playerClubAnalytics.js";
import { placeClubMatchBet, settleClubMatchBets } from "../services/clubsBetting.js";
import {
  activeCaptainApprovalComplete,
  validateRetention,
  debitClubWallet,
  reserveClubWallet,
  releaseClubCommitment,
  creditPlayerWallet,
} from "../services/clubsEconomy.js";

const router = express.Router();

const FORMATION_ACTIVE_STATUSES = [
  "pendingMutualAgreement",
  "pendingName",
  "pendingCaptainVoteSetup",
  "captainVote",
  "pendingCaptainDetailsApproval",
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

function captainDetailsAreApproved(application) {
  const elected = (application?.electedCaptainIds || []).map(String);
  const approvals = new Set((application?.detailsApprovedBy || []).map(String));
  const details = String(application?.details || "").trim();
  return Boolean(details) && elected.length > 0 && elected.every(id => approvals.has(id));
}

// Older deployments used pendingAdminApproval immediately after the captain vote.
// Move unfinished applications back to the correct details stage when they are read.
async function normalizeLegacyFormationStage(application) {
  if (application?.status !== "pendingAdminApproval" || captainDetailsAreApproved(application)) {
    return application;
  }

  application.status = application.electedCaptainIds?.length
    ? "pendingCaptainDetailsApproval"
    : "pendingCaptainVoteSetup";
  try {
    await application.save();
    return application;
  } catch (error) {
    // The same legacy application may be opened simultaneously by two members
    // or by a captain and an admin. Reload the winning transition on a version race.
    if (error?.name !== "VersionError") throw error;
    const latest = await ClubFormationApplication.findById(application._id);
    if (!latest) throw error;
    return latest;
  }
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
    clubMinMembers: CLUB_MIN_MEMBERS,
    clubMaxMembers: CLUB_MAX_MEMBERS,
    clubStartingBalance: CLUB_STARTING_BALANCE,
    formations: CLUB_FORMATIONS,
    formations4: CLUB_FORMATIONS_4,
    formations5: CLUB_FORMATIONS_5,
    activeClubPolicy: "one-active-club-per-player",
    captainPolicy: "top-two-ovr-candidates; every active member votes; tie creates two co-captains",
    bettingPolicy: "player-wallet betting only; one bet per player per fixture; 10-100 credits; pooled winner payout; draw/cancellation/no-winner refunds; club members cannot bet on their own fixture",
    playerRewardPolicy: "10 appearance; 25 MOTM; 10 clean sheet; valid betting winnings return to the winning users' Player Wallets",
    reviewPolicy: "one teammate review and one opponent review per reviewer/reviewed relationship",
  });
});


function matchDateKey(match) {
  if (match?.fixtureDate) return String(match.fixtureDate).slice(0, 10);
  const value = match?.scheduledAt || match?.date;
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : clubDateKey(date);
}

function publicMatchSnapshot(match, clubsById) {
  const clubA = clubsById.get(String(match.clubAId)) || null;
  const clubB = clubsById.get(String(match.clubBId)) || null;
  return {
    _id: match._id,
    clubAId: match.clubAId,
    clubBId: match.clubBId,
    clubAName: clubA?.name || "Club",
    clubBName: clubB?.name || "Club",
    status: match.status,
    fixtureDate: match.fixtureDate || matchDateKey(match),
    scheduledAt: match.scheduledAt,
    clubAScore: match.clubAScore ?? null,
    clubBScore: match.clubBScore ?? null,
    mainMatchId: match.mainMatchId || null,
    winnerClubId: match.winnerClubId || null,
  };
}

router.get("/home", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;

  try {
    const [clubs, applications] = await Promise.all([
      Club.find({ status: "approved" }).sort({ nameNormalized: 1 }).lean(),
      ClubFormationApplication.find({ memberIds: playerId }).sort({ createdAt: -1 }).lean(),
     ]);

    const currentClub =
      clubs.find(club => club.memberIds?.some(id => String(id) === String(playerId))) || null;

    const captainClubIds = currentClub &&
      currentClub.captainIds?.some(id => String(id) === String(playerId))
      ? [currentClub._id]
      : [];

    const auction = await AuctionOffer.find({
      $or: [
        { playerId, status: { $in: ["active", "chosenByPlayer", "approved"] } },
        ...(captainClubIds.length ? [{ clubId: { $in: captainClubIds }, status: "chosenByPlayer" }] : []),
      ],
    }).sort({ createdAt: -1 }).lean();

    const clubIds = currentClub ? [currentClub._id] : [];
    const clubMatches = clubIds.length
      ? await ClubMatch.find({
          $or: [{ clubAId: currentClub._id }, { clubBId: currentClub._id }],
        }).sort({ scheduledAt: 1, createdAt: 1 }).lean()
      : [];

    const clubMap = new Map(clubs.map(club => [String(club._id), club]));
    const today = clubDateKey();
    const todayMatches = clubMatches
      .filter(match => matchDateKey(match) === today && ["requested", "accepted", "completed"].includes(match.status))
      .map(match => publicMatchSnapshot(match, clubMap));

    const upcomingMatches = clubMatches
      .filter(match => {
        const key = matchDateKey(match);
        return key > today && ["requested", "accepted"].includes(match.status);
      })
      .sort((a, b) => matchDateKey(a).localeCompare(matchDateKey(b)))
      .slice(0, 3)
      .map(match => publicMatchSnapshot(match, clubMap));

    const recentMatches = clubMatches
      .filter(match => match.status === "completed" && match.mainMatchId)
      .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))
      .slice(0, 5)
      .map(match => publicMatchSnapshot(match, clubMap));

    const form = recentMatches.map(match => {
      if (match.clubAScore === match.clubBScore) return "D";
      const won = String(match.winnerClubId) === String(currentClub?._id);
      return won ? "W" : "L";
    });

    const recentHistory = currentClub
      ? await ClubHistory.find({ clubId: currentClub._id })
          .sort({ occurredAt: -1, createdAt: -1 })
          .limit(6)
          .lean()
      : [];

    const pendingFormation = applications.find(application =>
      ["pendingMutualAgreement", "pendingName", "pendingCaptainVoteSetup", "captainVote", "pendingCaptainDetailsApproval", "pendingAdminApproval"].includes(application.status)
    );

    let nextAction = null;

    if (!currentClub && pendingFormation) {
      if (
        pendingFormation.status === "pendingMutualAgreement" &&
        pendingFormation.memberApprovals?.some(item => String(item.playerId) === String(playerId) && item.status === "pending")
      ) {
        nextAction = {
          type: "formation-accept",
          section: "overview",
          eyebrow: "CLUB FORMATION",
          title: "Your invitation is waiting",
          description: "Accept or decline the Club formation invitation.",
          actionLabel: "REVIEW INVITATION →",
        };
      } else if (pendingFormation.status === "pendingName") {
        nextAction = {
          type: "formation-name",
          section: "overview",
          eyebrow: "CLUB FORMATION",
          title: "Choose the permanent Club name",
          description: "Everyone has accepted. The formation is ready for its identity.",
          actionLabel: "NAME THE CLUB →",
        };
      } else if (pendingFormation.status === "pendingCaptainVoteSetup") {
        nextAction = {
          type: "captain-setup",
          section: "overview",
          eyebrow: "CAPTAIN ELECTION",
          title: "Start the captain vote",
          description: "The squad is ready to elect its captain.",
          actionLabel: "START VOTE →",
        };
      } else if (pendingFormation.status === "captainVote") {
        const alreadyVoted = pendingFormation.captainVotes?.some(vote => String(vote.voterPlayerId) === String(playerId));
        if (!alreadyVoted) {
          const voted = new Set((pendingFormation.captainVotes || []).map(vote => String(vote.voterPlayerId)));
          const remaining = pendingFormation.memberIds.filter(id => !voted.has(String(id))).length;
          nextAction = {
            type: "captain-vote",
            section: "overview",
            eyebrow: "CAPTAIN ELECTION",
            title: "Your captain vote is waiting",
            description: remaining + " member" + (remaining === 1 ? "" : "s") + " still need to vote.",
            actionLabel: "CAST YOUR VOTE →",
          };
        }
      } else if (pendingFormation.status === "pendingCaptainDetailsApproval") {
        const isElectedCaptain = pendingFormation.electedCaptainIds?.some(id => String(id) === String(playerId));
        const hasApprovedDetails = pendingFormation.detailsApprovedBy?.some(id => String(id) === String(playerId));
        nextAction = {
          type: "formation-details",
          section: "overview",
          eyebrow: "CLUB FORMATION",
          title: isElectedCaptain
            ? hasApprovedDetails ? "Details approved — awaiting co-captain" : "Confirm Club details"
            : "Captain details approval pending",
          description: isElectedCaptain
            ? hasApprovedDetails
              ? "Your approval is recorded. The other elected captain must approve the same details."
              : "Review the Club identity and approve the details before admin review."
            : "The elected captain(s) must approve the Club details before admin review.",
          actionLabel: isElectedCaptain && !hasApprovedDetails ? "CONFIRM CLUB DETAILS →" : "VIEW FORMATION →",
        };
      } else if (pendingFormation.status === "pendingAdminApproval") {
        nextAction = {
          type: "formation-admin-review",
          section: "overview",
          eyebrow: "CLUB FORMATION",
          title: "Club formation submitted",
          description: "All elected captain(s) approved the details. Your application is waiting for administrator review.",
          actionLabel: "VIEW FORMATION →",
        };
      }
    }

    if (!nextAction && currentClub) {
      const pendingMatch = clubMatches.find(match =>
        match.status === "requested" &&
        String(match.clubBId) === String(currentClub._id) &&
        currentClub.captainIds?.some(id => String(id) === String(playerId))
      );
      if (pendingMatch) {
        nextAction = {
          type: "match-respond",
          section: "overview",
          subsection: "matches",
          eyebrow: "MATCH REQUEST",
          title: clubMap.get(String(pendingMatch.clubAId))?.name + " wants to play you",
          description: "Review the proposed Club Match and respond as captain.",
          actionLabel: "REVIEW MATCH →",
          entityId: pendingMatch._id,
        };
      }
    }

    if (!nextAction && currentClub) {
      const ownActiveOffer = auction.find(offer => String(offer.playerId) === String(playerId) && offer.status === "active");
      if (ownActiveOffer) {
        nextAction = {
          type: "auction-choose",
          section: "myClub",
          subsection: "auctions",
          eyebrow: "AUCTION OFFER",
          title: "You received a signing offer",
          description: "Choose whether you want to join the Club behind the offer.",
          actionLabel: "VIEW OFFER →",
          entityId: ownActiveOffer._id,
        };
      }
    }

    if (!nextAction && currentClub) {
      const incomingOffer = auction.find(offer =>
        offer.status === "chosenByPlayer" &&
        String(offer.playerId) !== String(playerId) &&
        currentClub.captainIds?.some(id => String(id) === String(playerId)) &&
        String(offer.clubId) === String(currentClub._id)
      );
      if (incomingOffer) {
        nextAction = {
          type: "auction-approve",
          section: "myClub",
          subsection: "auctions",
          eyebrow: "CAPTAIN APPROVAL",
          title: "A player chose your Club",
          description: "Review the signing and add your captain approval.",
          actionLabel: "REVIEW SIGNING →",
          entityId: incomingOffer._id,
        };
      }
    }

    if (!nextAction && currentClub) {
      const captainJoin = await JoinRequest.findOne({
        clubId: currentClub._id,
        status: "pending",
      }).lean();
      if (captainJoin && currentClub.captainIds?.some(id => String(id) === String(playerId))) {
        nextAction = {
          type: "join-request",
          section: "overview",
          eyebrow: "JOIN REQUEST",
          title: "A player wants to join your Club",
          description: "As captain, review the pending application.",
          actionLabel: "REVIEW REQUEST →",
          entityId: captainJoin._id,
        };
      }
    }

    if (!nextAction && currentClub) {
      const activeContracts = await ClubContract.find({ clubId: currentClub._id, status: "active" }).sort({ endAt: 1 }).lean();
      const boundaryAt = activeContracts[0]?.endAt || null;
      if (boundaryAt && new Date() >= new Date(boundaryAt) && currentClub.captainIds?.some(id => String(id) === String(playerId))) {
        const decision = await ClubRenewalDecision.findOne({ clubId: currentClub._id, boundaryAt }).lean();
        const approvedBy = decision?.captainApprovalIds || [];
        const awaiting = currentClub.captainIds.some(id => !approvedBy.some(approved => String(approved) === String(id)));
        if (!decision || awaiting) {
          nextAction = {
            type: "renewal",
            section: "myClub",
            subsection: "squad",
            eyebrow: "CONTRACT CONTROL",
            title: "Club renewal is due",
            description: "Keep 4–5 players to renew the Club, or retain fewer to archive it.",
            actionLabel: "OPEN RENEWAL →",
            entityId: currentClub._id,
          };
        }
      }
    }

    if (!nextAction && todayMatches.length) {
      const match = todayMatches[0];
      nextAction = {
        type: "match-today",
        section: "overview",
        subsection: "matches",
        eyebrow: "MATCHDAY",
        title: match.clubAName + " vs " + match.clubBName,
        description: match.status === "completed" ? "Today's Club Match is complete." : "Your Club has a fixture today.",
        actionLabel: "VIEW MATCH →",
        entityId: match._id,
      };
    }

    if (!nextAction && currentClub && upcomingMatches.length) {
      const match = upcomingMatches[0];
      nextAction = {
        type: "match-upcoming",
        section: "overview",
        subsection: "matches",
        eyebrow: "NEXT MATCH",
        title: match.clubAName + " vs " + match.clubBName,
        description: "Upcoming fixture on " + match.fixtureDate + ".",
        actionLabel: "VIEW FIXTURE →",
        entityId: match._id,
      };
    }

    if (!nextAction) {
      nextAction = currentClub
        ? {
            type: "all-clear",
            section: "myClub",
            subsection: "squad",
            eyebrow: "CLUB STATUS",
            title: "Your Club is up to date",
            description: "No urgent Club action is waiting for you.",
            actionLabel: "OPEN CLUB HQ →",
          }
        : {
            type: "no-club",
            section: "overview",
            eyebrow: "GET STARTED",
            title: "Build your Club world",
            description: "Form a 4–5 player squad or request to join an official Club.",
            actionLabel: "EXPLORE CLUBS →",
          };
    }

    return res.json({
      currentClub,
      clubOvr: null,
      memberCount: currentClub?.memberIds?.length || 0,
      captainCount: currentClub?.captainIds?.length || 0,
      nextAction,
      todayMatches,
      upcomingMatches,
      recentMatches,
      form,
      recentHistory,
    });
  } catch (error) {
    console.error("Load Clubs home command center error:", error);
    return res.status(500).json({ message: "Failed to load your Clubs command center." });
  }
});

// Public Clubs reads remain available to everyone. Player actions enforce
// linked-account authentication at the individual endpoint, while admin
// operations are protected explicitly with requireAdmin below.

router.get("/formation/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;

  try {
    const applications = await ClubFormationApplication.find({
      memberIds: playerId,
    }).sort({ createdAt: -1 });

    for (const application of applications) {
      await normalizeLegacyFormationStage(application);
    }

    const allMemberIds = [...new Set(applications.flatMap(application => (application.memberIds || []).map(String)))];
    const memberPlayers = allMemberIds.length
      ? await Player.find({ _id: { $in: allMemberIds } })
          .select("_id name position profileImage ovrSnapshot.currentOvr")
          .lean()
      : [];
    const playersById = new Map(memberPlayers.map(player => [String(player._id), player]));

    const enriched = applications.map(application => ({
      ...application.toObject(),
      members: (application.memberIds || []).map(id => playersById.get(String(id)) || { _id: id, name: "Player" }),
    }));

    return res.json(enriched);
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

    if (players.length !== memberIds.length) {
      return res.status(400).json({
        message: "All selected players must exist in GG Matchday.",
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

    if (linkedUsers.length !== memberIds.length) {
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
          "The club name can only be proposed after every member accepts.",
      });
    }

    if (
      !application.memberApprovals.every(
        approval => approval.status === "accepted",
      )
    ) {
      return res.status(409).json({
        message: "Every member must accept before the club name can be proposed.",
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
  const wallet = await PlayerWallet.findOne({ playerId }).lean() || { playerId, balance: 0 };
  const transactions = await PlayerWalletTransaction.find({ playerId }).sort({ createdAt: -1 }).limit(25).lean();
  return res.json({ wallet, transactions });
});

router.get("/:clubId/wallet", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const state = await getUserClubCaptainState(playerId, req.params.clubId);
  if (!state) return res.status(404).json({ message: "Club not found." });
  if (!state.club.memberIds.some(id => String(id) === String(playerId))) {
    return res.status(403).json({ message: "Only Club members can view this Club wallet." });
  }
  const transactions = await ClubWalletTransaction.find({ clubId: req.params.clubId }).sort({ createdAt: -1 }).limit(25).lean();
  const source = state.club?.toObject ? state.club.toObject() : state.club;
  const balance = Number(source?.balance || 0);
  const committedBalance = Number(source?.committedBalance || 0);
  return res.json({ club: { ...source, availableBalance: Math.max(0, balance - committedBalance) }, transactions });
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

router.get("/players/discovery", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const [players, activeContracts, recentMatches] = await Promise.all([
      Player.find({})
        .select("_id name position profileImage jerseyNumber ovrSnapshot.currentOvr")
        .sort({ name: 1 })
        .lean(),
      ClubContract.find({ status: "active" }).select("playerId clubId").lean(),
      Match.find({ "participants.0": { $exists: true } })
        .sort({ date: -1, createdAt: -1 })
        .limit(40)
        .select("_id date participants events")
        .lean(),
    ]);

    const activeIds = new Set(activeContracts.map(contract => String(contract.playerId)));
    const byPlayer = new Map(players.map(player => [
      String(player._id),
      {
        player,
        matchesPlayed: 0,
        goals: 0,
        assists: 0,
        ratings: [],
      },
    ]));

    for (const match of recentMatches) {
      for (const participant of match.participants || []) {
        const id = String(participant.player);
        const row = byPlayer.get(id);
        if (!row) continue;
        row.matchesPlayed += 1;
        const effectiveRating = effectiveMatchRating(participant);
        if (effectiveRating !== null) row.ratings.push(effectiveRating);
      }
      for (const event of match.events || []) {
        const id = String(event.player);
        const row = byPlayer.get(id);
        if (!row) continue;
        if (event.type === "goal") row.goals += 1;
        if (event.type === "assist") row.assists += 1;
      }
    }

    return res.json(players.map(player => {
      const row = byPlayer.get(String(player._id));
      const ratings = (row?.ratings || []).slice(0, 5);
      const formAverage = ratings.length
        ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2)
        : null;
      return {
        ...player,
        currentOvr: player.ovrSnapshot?.currentOvr ?? null,
        matchesPlayed: row?.matchesPlayed || 0,
        goals: row?.goals || 0,
        assists: row?.assists || 0,
        formAverage,
        available: !activeIds.has(String(player._id)),
      };
    }));
  } catch (error) {
    console.error("Club player discovery error:", error);
    return res.status(500).json({ message: "Failed to load Club player discovery." });
  }
});

router.get("/auction/eligible-players", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const active = await ClubContract.find({ status: "active" }).select("playerId").lean();
  const activeIds = active.map(item => item.playerId);
  const players = await Player.find(activeIds.length ? { _id: { $nin: activeIds } } : {}).select("_id name position profileImage jerseyNumber").sort({ name: 1 }).lean();
  return res.json(players);
});

router.get("/auction/offers/:playerId", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.playerId)) return res.status(400).json({ message: "Invalid player id." });
  const signedInPlayerId = req.user?.playerProfile ? String(req.user.playerProfile) : "";
  if (signedInPlayerId !== String(req.params.playerId) && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Auction offers are private to the player receiving them." });
  }
  const offers = await AuctionOffer.find({ playerId: req.params.playerId, status: { $in: ["active", "chosenByPlayer", "approved"] } }).sort({ amount: -1, createdAt: 1 }).lean();
  return res.json(offers);
});

router.post("/auction/offers", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const clubId = req.body?.clubId;
  const playerId = req.body?.playerId;
  if (!mongoose.isValidObjectId(clubId) || !mongoose.isValidObjectId(playerId)) return res.status(400).json({ message: "Valid club and player ids are required." });
  const session = await getClubsConnection().startSession();
  try {
    let offer;
    await session.withTransaction(async () => {
      const state = await getUserClubCaptainState(req.user.playerProfile, clubId);
      if (!state?.isCaptain) throw new Error("Only a club captain can make a signing offer.");
      if (state.club.memberIds.length >= CLUB_MAX_MEMBERS) throw new Error("Your club already has five players.");
      if (state.club.memberIds.some(id => String(id) === String(playerId))) throw new Error("That player is already in your club.");
      const activeContract = await ClubContract.findOne({ playerId, status: "active" }).session(session).lean();
      if (activeContract) throw new Error("That player is already under an active club contract.");
      const highest = await AuctionOffer.findOne({ playerId, status: "active", expiresAt: { $gt: new Date() } }).sort({ amount: -1 }).session(session).lean();
      const amount = validateAuctionBid(req.body?.amount, highest?.amount || 0);
      await reserveClubWallet({ clubId, amount, session });
      const created = await AuctionOffer.create([{ clubId, playerId, amount, status: "active", expiresAt: auctionOfferExpiry() }], { session });
      offer = created[0];
    });
    return res.status(201).json(offer);
  } catch (error) {
    const conflict = error?.code === 11000 || /insufficient available balance|budget reservation/i.test(String(error?.message || ""));
    return res.status(conflict ? 409 : 400).json({ message: error.message || "Failed to create signing offer." });
  } finally {
    await session.endSession();
  }
});
router.post("/auction/offers/:offerId/choose", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.offerId)) return res.status(400).json({ message: "Invalid offer id." });
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const session = await getClubsConnection().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const now = new Date();
      const offer = await AuctionOffer.findOne({
        _id: req.params.offerId,
        playerId,
        status: "active",
        expiresAt: { $gt: now },
      }).session(session);
      if (!offer) throw new Error("This signing offer is no longer active or has expired.");
      const activeContract = await ClubContract.findOne({ playerId, status: "active" }).session(session);
      if (activeContract) throw new Error("You must be outside an active club contract to sign.");
      const chosen = await AuctionOffer.findOneAndUpdate(
        { _id: offer._id, status: "active", expiresAt: { $gt: now } },
        { $set: { status: "chosenByPlayer", playerChosenAt: now } },
        { returnDocument: "after", session },
      );
      if (!chosen) throw new Error("This offer changed before it could be selected.");
      const otherOffers = await AuctionOffer.find({ playerId, _id: { $ne: offer._id }, status: "active" }).session(session);
      for (const otherOffer of otherOffers) {
        const rejected = await AuctionOffer.findOneAndUpdate(
          { _id: otherOffer._id, status: "active" },
          { $set: { status: "rejectedByPlayer" } },
          { returnDocument: "after", session },
        );
        if (rejected) {
          const otherClub = await Club.findById(rejected.clubId).session(session).lean();
          if (Number(otherClub?.committedBalance || 0) >= Number(rejected.amount || 0)) {
            await releaseClubCommitment({ clubId: rejected.clubId, amount: rejected.amount, session });
          }
        }
      }
      result = chosen;
    });
    return res.json(result);
  } catch (error) {
    return res.status(error?.code === 11000 ? 409 : 400).json({
      message: error?.code === 11000 ? "Another signing offer has already been chosen." : error.message || "Failed to choose the signing offer.",
    });
  } finally {
    await session.endSession();
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
      const now = new Date();
      const offer = await AuctionOffer.findById(req.params.offerId).session(session);
      if (!offer) throw new Error("Offer not found.");
      if (offer.status !== "chosenByPlayer") throw new Error("The player must choose this offer before captain approval.");
      if (!offer.expiresAt || new Date(offer.expiresAt) <= now) {
        throw new Error("This signing offer has expired and can no longer be approved.");
      }
      const club = await Club.findOne({ _id: offer.clubId, status: "approved" }).session(session);
      if (!club) throw new Error("Club not found.");
      if (!club.captainIds.some(id => String(id) === String(playerId))) throw new Error("Only an elected captain can approve the signing.");
      if (club.memberIds.length >= CLUB_MAX_MEMBERS) throw new Error("The club already has five players.");
      const activeContract = await ClubContract.findOne({ playerId: offer.playerId, status: "active" }).session(session);
      if (activeContract) throw new Error("That player is already in an active club.");
      const approvalIds = [...new Set([...offer.captainApprovalIds.map(String), String(playerId)])];
      offer.captainApprovalIds = approvalIds;
      if (!activeCaptainApprovalComplete(club.captainIds, approvalIds)) {
        await offer.save({ session });
        result = { offer, club, pendingCaptainApproval: true };
        return;
      }
      if (Number(club.balance || 0) < Number(offer.amount) || Number(club.committedBalance || 0) < Number(offer.amount)) {
        await reserveClubWallet({ clubId: club._id, amount: offer.amount, session });
      }
      const endAt = nextRenewalBoundary(now);
      const updatedClub = await Club.findOneAndUpdate(
        { _id: club._id, status: "approved", memberIds: { $not: { $size: CLUB_MAX_MEMBERS }, $ne: offer.playerId } },
        { $addToSet: { memberIds: offer.playerId } },
        { returnDocument: "after", session },
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
        commitmentAmount: offer.amount,
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
      offer.captainApprovalIds = approvalIds;
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
    if (club.memberIds.length >= CLUB_MAX_MEMBERS) return res.status(409).json({ message: "That club already has five players." });
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
      if (club.memberIds.length >= CLUB_MAX_MEMBERS) throw new Error("The club already has five players.");
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
        { returnDocument: "after", session },
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

router.get("/:clubId/renewal", requireAuth, async (req, res) => {
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

router.post("/:clubId/renewal", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  const clubId = req.params.clubId;
  try {
    const state = await getUserClubCaptainState(playerId, clubId);
    if (!state?.isCaptain) return res.status(403).json({ message: "Only club captains can decide renewals." });
    if (state.club.memberIds.length < CLUB_MIN_MEMBERS || state.club.memberIds.length > CLUB_MAX_MEMBERS) {
      return res.status(409).json({ message: "Renewal requires a 4-5 player club." });
    }

    const requestedRetention = req.body?.retainedPlayerIds;
    if (requestedRetention !== undefined && !Array.isArray(requestedRetention)) {
      return res.status(400).json({ message: "Retained players must be submitted as a list." });
    }
    const retained = validateRetention(state.club.memberIds, requestedRetention, state.club.captainIds);
    const activeContracts = await ClubContract.find({ clubId, status: "active" }).sort({ endAt: 1 }).lean();
    if (activeContracts.length < CLUB_MIN_MEMBERS || activeContracts.length > CLUB_MAX_MEMBERS) {
      return res.status(409).json({ message: "The club must have 4 or 5 active contracts to renew." });
    }
    const storedBoundaryAt = activeContracts[0].endAt;
    const boundaryAt = clubDateStartUtc(clubDateKey(storedBoundaryAt));
    if (new Date() < boundaryAt) return res.status(409).json({ message: "This club's renewal boundary has not arrived yet." });

    let decision = await ClubRenewalDecision.findOne({ clubId, boundaryAt });
    if (!decision && new Date(storedBoundaryAt).getTime() !== boundaryAt.getTime()) {
      decision = await ClubRenewalDecision.findOne({ clubId, boundaryAt: storedBoundaryAt });
    }
    if (!decision) {
      decision = await ClubRenewalDecision.create({
        clubId,
        boundaryAt,
        retainedPlayerIds: retained,
        captainApprovalIds: [playerId],
      });
    } else {
      if (JSON.stringify(decision.retainedPlayerIds.map(String).sort()) !== JSON.stringify(retained.map(String).sort())) {
        return res.status(409).json({ message: "Both captains must approve the same retained players." });
      }
      decision.captainApprovalIds = [...new Set([...decision.captainApprovalIds.map(String), String(playerId)])];
      await decision.save();
    }

    if (!activeCaptainApprovalComplete(state.club.captainIds, decision.captainApprovalIds)) {
      return res.json({ status: decision.status, decision });
    }

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

        if (retained.length < 4) {
          club.memberIds = [];
          club.captainIds = [];
          club.status = "archived";
          await club.save({ session });
          for (const releasedId of contracts.map(contract => contract.playerId)) {
            await ClubHistory.create([{
              clubId,
              playerId: releasedId,
              eventType: "memberReleased",
              description: "Player contract ended at renewal; Club dissolved because fewer than four players were jointly retained.",
              metadata: { boundaryAt, retainedPlayerIds: retained },
            }], { session });
          }
          await ClubHistory.create([{
            clubId,
            eventType: "archived",
            description: "Club archived at contract renewal because fewer than four players were jointly retained.",
            metadata: { boundaryAt, retainedPlayerIds: retained },
          }], { session });
          decision.status = "applied";
          decision.appliedAt = new Date();
          await decision.save({ session });
          updated = club;
          return;
        }

        const nextEnd = nextRenewalBoundary(boundaryAt);
        const newContracts = retained.map(retainedId => ({
          clubId,
          playerId: retainedId,
          startAt: boundaryAt,
          endAt: nextEnd,
          signingAmount: 0,
          source: "renewal",
          renewalNumber: (contracts.find(c => String(c.playerId) === String(retainedId))?.renewalNumber || 0) + 1,
        }));
        await ClubContract.create(newContracts, { session, ordered: true });
        club.memberIds = retained;
        club.captainIds = club.captainIds.filter(id => retainedSet.has(String(id)));
        if (!club.captainIds.length) throw new Error("At least one captain must remain for renewal.");
        await club.save({ session });

        for (const releasedId of contracts.filter(c => !retainedSet.has(String(c.playerId))).map(c => c.playerId)) {
          await ClubHistory.create([{
            clubId,
            playerId: releasedId,
            eventType: "memberReleased",
            description: "Player released at contract renewal.",
            metadata: { boundaryAt, retainedPlayerIds: retained },
          }], { session });
        }
        await ClubHistory.create([{
          clubId,
          eventType: "formationChanged",
          description: "Club roster renewed with retained players.",
          metadata: { boundaryAt, retainedPlayerIds: retained },
        }], { session });

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
  let previousStatus = "unknown";
  try {
    let result;
    await session.withTransaction(async () => {
      const existing = await ClubMatch.findById(req.params.matchId).session(session).select("settlementStatus").lean();
      if (existing) previousStatus = existing.settlementStatus || "pending";
      result = await settleClubMatchRewards({ clubMatchId: req.params.matchId, session });
      await settleClubMatchBets({ clubMatchId: req.params.matchId, session });
    });
    await writeClubAdminAudit(req, {
      action: "match-settlement",
      entityType: "clubMatch",
      entityId: new mongoose.Types.ObjectId(req.params.matchId),
      previousStatus,
      nextStatus: result?.clubMatch?.settlementStatus || "settled",
      outcome: "success",
      reason: result?.alreadySettled ? "Admin requested settlement; canonical service confirmed it was already settled." : "Admin invoked canonical settlement and betting settlement services.",
    });
    return res.json(result);
  } catch (error) {
    await writeClubAdminAudit(req, {
      action: "match-settlement",
      entityType: "clubMatch",
      entityId: new mongoose.Types.ObjectId(req.params.matchId),
      previousStatus,
      nextStatus: previousStatus,
      outcome: "failed",
      reason: String(error?.message || "Settlement failed").slice(0, 500),
    });
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
    const match = await ClubMatch.findById(req.params.matchId).select("status prediction").lean();
    if (!match) return res.status(404).json({ message: "Club Match not found." });
    return res.json(match.prediction || null);
  } catch {
    return res.status(500).json({ message: "Failed to load prediction." });
  }
});

router.post("/matches/:matchId/prediction/refresh", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });
  try {
    const prediction = await generateClubMatchPrediction(req.params.matchId);
    return res.json(prediction);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to refresh prediction." });
  }
});

router.get("/matches/:matchId/bets/me", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ message: "Invalid club match id." });
  const match = await ClubMatch.findById(req.params.matchId).lean();
  if (!match) return res.status(404).json({ message: "Club Match not found." });
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
    const matches = await ClubMatch.find({}).sort({ scheduledAt: -1 }).limit(100).lean();
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
  const { clubAId, clubBId, fixtureDate } = req.body || {};

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

    let fixture;
    try {
      fixture = normalizeFixtureDate(fixtureDate);
    } catch (dateError) {
      return res.status(400).json({ message: dateError.message });
    }

    const todayKey = clubDateKey();
    if (fixture.key <= todayKey) {
      return res.status(400).json({ message: "Choose a future Club Match date." });
    }

    const existingBooking = await ClubMatch.findOne({
      fixtureDate: fixture.key,
      source: "booked",
      status: { $in: ["requested", "accepted", "completed"] },
    }).lean();
    if (existingBooking) {
      return res.status(409).json({ message: "A Club Match fixture is already booked for that date." });
    }

    const match = await ClubMatch.create({
      clubAId,
      clubBId,
      requestedByClubId: clubAId,
      fixtureDate: fixture.key,
      scheduledAt: fixture.date,
      source: "booked",
      status: "requested",
    });
    return res.status(201).json(match);
  } catch (error) {
    console.error("Create club match request error:", error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: "A Club Match fixture is already booked for that date." });
    }
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
    if (new Date() >= clubMatchRequestExpiry(match.createdAt, match.scheduledAt)) {
      match.status = "declined";
      match.responseDecision = "decline";
      await match.save();
      return res.status(409).json({ message: "This Club Match request has expired." });
    }

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
    if (match.status === "accepted") {
      try {
        await generateClubMatchPrediction(match._id);
      } catch (predictionError) {
        console.error("Club prediction generation failed:", predictionError);
      }
    }
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
    const session = await getClubsConnection().startSession();
    try {
      let cancelled;
      await session.withTransaction(async () => {
        const current = await ClubMatch.findById(match._id).session(session);
        if (!current) throw new Error("Club match not found.");
        if (!["requested", "accepted"].includes(current.status)) {
          throw new Error("This club match cannot be cancelled now.");
        }
        current.status = "cancelled";
        cancelled = await current.save({ session });
        await settleClubMatchBets({ clubMatchId: match._id, session });
      });
      return res.json(cancelled);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("Cancel club match error:", error);
    return res.status(400).json({ message: error.message || "Failed to cancel club match." });
  }
});

router.get("/", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;

  try {
    const clubs = await Club.find({ status: "approved" })
      .select("_id name nameNormalized description logoUrl memberIds captainIds status approvedAt")
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
      .select("_id name memberIds captainIds")
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

router.get("/player/:playerId/analytics", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.playerId)) {
    return res.status(400).json({ message: "Invalid player id." });
  }

  try {
    const player = await Player.findById(req.params.playerId).select("_id").lean();
    if (!player) return res.status(404).json({ message: "Player not found." });

    const rows = await ClubPlayerStats.find({ playerId: req.params.playerId })
      .populate("clubId", "name logoUrl status")
      .lean();
    return res.json(buildPlayerClubAnalytics(rows));
  } catch (error) {
    console.error("Load player Club analytics error:", error);
    return res.status(500).json({ message: "Failed to load player Club analytics." });
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
    }).select("_id name nameNormalized description logoUrl memberIds captainIds status approvedAt").lean();

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
    if (!application.memberIds.some(id => String(id) === String(playerId))) return res.status(403).json({ message: "Only current Club members can vote." });
    const candidatePlayerId = String(req.body?.candidatePlayerId || "");
    if (!application.captainCandidates.some(id => String(id) === candidatePlayerId)) return res.status(400).json({ message: "Vote for one of the two eligible captain candidates." });
    if (application.captainVotes.some(vote => String(vote.voterPlayerId) === String(playerId))) return res.status(409).json({ message: "You have already voted." });

    application.captainVotes.push({ voterPlayerId: playerId, candidatePlayerId });

    const uniqueVoterIds = new Set(application.captainVotes.map(vote => String(vote.voterPlayerId)));
    const allMembersVoted = application.memberIds.every(id => uniqueVoterIds.has(String(id)));
    if (allMembersVoted) {
      const elected = resolveCaptainVote(application.captainCandidates, application.captainVotes);
      application.electedCaptainIds = elected;
      application.details = "";
      application.detailsApprovedBy = [];
      application.status = "pendingCaptainDetailsApproval";
    }

    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Captain vote error:", error);
    if (error?.name === "VersionError") {
      return res.status(409).json({ message: "Another captain vote was recorded at the same time. Refresh and try again." });
    }
    return res.status(500).json({ message: "Failed to record the captain vote." });
  }
});
router.post("/formation/:id/details", requireAuth, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = requireLinkedPlayer(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid formation application id." });
  }
  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Club formation application not found." });

    // Older deployments used pendingAdminApproval for both captain details and admin review.
    await normalizeLegacyFormationStage(application);
    if (application.status !== "pendingCaptainDetailsApproval") {
      return res.status(409).json({ message: "Club details are not awaiting captain approval." });
    }
    const electedCaptainIds = (application.electedCaptainIds || []).map(String);
    if (!electedCaptainIds.includes(String(playerId))) {
      return res.status(403).json({ message: "Only elected Club captains can approve Club details." });
    }
    if ((application.detailsApprovedBy || []).some(id => String(id) === String(playerId))) {
      return res.status(409).json({ message: "You have already approved these Club details." });
    }

    const details = String(req.body?.details ?? application.details ?? "").trim();
    if (!details) {
      return res.status(400).json({ message: "Club details are required before approval." });
    }
    if (details.length > 500) {
      return res.status(400).json({ message: "Club details must be 500 characters or fewer." });
    }

    if (String(application.details || "").trim() !== details) {
      application.details = details;
      application.detailsApprovedBy = [playerId];
    } else {
      application.detailsApprovedBy = [
        ...new Set([...(application.detailsApprovedBy || []).map(String), String(playerId)]),
      ];
    }

    if (electedCaptainIds.every(id => application.detailsApprovedBy.some(approved => String(approved) === id))) {
      application.status = "pendingAdminApproval";
    }
    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Club details submission error:", error);
    if (error?.name === "VersionError") {
      return res.status(409).json({ message: "Club details changed while you were approving them. Refresh and try again." });
    }
    return res.status(400).json({ message: error.message || "Failed to save Club details." });
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
    application.status = "pendingName";
    application.proposedName = "";
    application.proposedNameNormalized = "";
    application.details = "";
    application.captainCandidates = [];
    application.captainVotes = [];
    application.electedCaptainIds = [];
    application.detailsApprovedBy = [];
    application.rejectionReason = "";
    await application.save();
    return res.json(application);
  } catch (error) {
    console.error("Club resubmission error:", error);
    return res.status(500).json({ message: "Failed to resubmit the club application." });
  }
});

async function buildAdminClubSnapshot(club) {
  const memberIds = (club.memberIds || []).map(id => String(id));
  const memberPlayers = memberIds.length
    ? await Player.find({ _id: { $in: memberIds } })
        .select("_id name position profileImage jerseyNumber")
        .lean()
    : [];
  const playersById = new Map(memberPlayers.map(player => [String(player._id), player]));
  const ovrByPlayerId = memberIds.length ? await calculateClubOVRs(memberIds) : new Map();
  return {
    ...club,
    memberCount: memberIds.length,
    captainCount: (club.captainIds || []).length,
    squadOvr: memberIds.length
      ? Math.round(memberIds.reduce((sum, id) => sum + Number(ovrByPlayerId.get(id) || 0), 0) / memberIds.length)
      : null,
    members: memberIds.map(id => ({
      ...playersById.get(id),
      ovr: Number(ovrByPlayerId.get(id) || 0) || null,
      isCaptain: (club.captainIds || []).some(captainId => String(captainId) === id),
    })),
  };
}

router.get("/admin/overview", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const [
      totalClubs,
      activeClubs,
      archivedClubs,
      pendingApplications,
      activeContracts,
      upcomingMatches,
      completedMatches,
    ] = await Promise.all([
      Club.countDocuments({}),
      Club.countDocuments({ status: "approved" }),
      Club.countDocuments({ status: "archived" }),
      (async () => {
        const formationDocs = await ClubFormationApplication.find({
          status: { $in: ["pendingCaptainDetailsApproval", "pendingAdminApproval"] },
        });
        for (const application of formationDocs) await normalizeLegacyFormationStage(application);
        return formationDocs.filter(application =>
          application.status === "pendingAdminApproval" && captainDetailsAreApproved(application),
        ).length;
      })(),
      ClubContract.countDocuments({ status: "active" }),
      ClubMatch.countDocuments({ status: { $in: ["requested", "accepted"] } }),
      ClubMatch.countDocuments({ status: "completed" }),
    ]);

    const recentClubs = await Club.find({})
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [syncIssues, renewalContracts, pendingMatchRows] = await Promise.all([
      ClubSyncJob.find({
        status: "pending",
        lastError: { $nin: ["", null] },
      }).sort({ nextAttemptAt: 1, createdAt: 1 }).limit(8).lean(),
      ClubContract.find({
        status: "active",
        endAt: { $gt: new Date(), $lte: horizon },
      }).sort({ endAt: 1 }).limit(30).lean(),
      ClubMatch.find({
        status: "requested",
      }).sort({ createdAt: 1 }).limit(10).lean(),
    ]);

    const attention = [];

    const formationDocs = await ClubFormationApplication.find({
      status: { $in: ["pendingCaptainDetailsApproval", "pendingAdminApproval"] },
    }).sort({ createdAt: 1 });
    for (const application of formationDocs) await normalizeLegacyFormationStage(application);
    const pendingApplicationDocs = formationDocs
      .filter(application => application.status === "pendingAdminApproval" && captainDetailsAreApproved(application))
      .slice(0, 8)
      .map(application => application.toObject());

    for (const application of pendingApplicationDocs) {
      attention.push({
        severity: "medium",
        type: "formation",
        target: "adminApplications",
        entityId: String(application._id),
        title: application.proposedName || "Unnamed Club",
        subtitle: (application.memberIds?.length || 0) + " players · awaiting approval",
        detail: "Formation completed and waiting for an administrator.",
        actionLabel: "REVIEW APPLICATION →",
        createdAt: application.createdAt,
      });
    }

    for (const job of syncIssues) {
      attention.push({
        severity: "high",
        type: "sync",
        target: "adminDashboard",
        entityId: String(job.mainMatchId),
        title: "Matchday → Clubs sync failed",
        subtitle: "Main Match " + String(job.mainMatchId),
        detail: String(job.lastError || "Sync retry pending."),
        actionLabel: "OPEN SYNC DETAIL →",
        createdAt: job.createdAt,
      });
    }

    const renewalClubIds = [...new Set(renewalContracts.map(contract => String(contract.clubId)))];
    if (renewalClubIds.length) {
      const renewalClubs = await Club.find({ _id: { $in: renewalClubIds }, status: "approved" })
        .select("_id name memberIds")
        .lean();
      for (const club of renewalClubs) {
        const boundary = renewalContracts.find(contract => String(contract.clubId) === String(club._id))?.endAt;
        attention.push({
          severity: "medium",
          type: "renewal",
          target: "adminClubs",
          entityId: String(club._id),
          title: club.name,
          subtitle: (club.memberIds?.length || 0) + "/5 members · renewal approaching",
          detail: "Contract boundary: " + new Date(boundary).toLocaleDateString(),
          actionLabel: "OPEN CLUB →",
          createdAt: boundary,
        });
      }
    }

    for (const match of pendingMatchRows) {
      const days = Math.max(0, Math.ceil((new Date(match.scheduledAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      attention.push({
        severity: "low",
        type: "match",
        target: "adminMatches",
        entityId: String(match._id),
        title: "Pending Club Match request",
        subtitle: "Fixture " + matchDateKey(match),
        detail: days <= 1 ? "Fixture is within 24 hours." : "Awaiting receiving Club response.",
        actionLabel: "OPEN MATCH →",
        createdAt: match.createdAt,
      });
    }

    attention.sort((a, b) => {
      const weight = { high: 0, medium: 1, low: 2 };
      return (weight[a.severity] - weight[b.severity]) || (new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    });

    return res.json({
      counts: {
        totalClubs,
        activeClubs,
        archivedClubs,
        pendingApplications,
        activeMembers: activeContracts,
        upcomingMatches,
        completedMatches,
        syncFailures: syncIssues.length,
        renewalRisks: renewalClubIds.length,
      },
      attention: attention.slice(0, 16),
      recentClubs,
    });
  } catch (error) {
    console.error("Load Clubs admin overview error:", error);
    return res.status(500).json({ message: "Failed to load Clubs admin overview." });
  }
});

router.get("/admin/clubs", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const clubDocs = await Club.find({})
      .sort({ status: 1, nameNormalized: 1 })
      .lean();
    const clubs = [];
    for (const club of clubDocs) {
      clubs.push(await buildAdminClubSnapshot(club));
    }
    return res.json(clubs);
  } catch (error) {
    console.error("Load all Clubs admin directory error:", error);
    return res.status(500).json({ message: "Failed to load Clubs directory." });
  }
});

router.get("/admin/matches", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const matches = await ClubMatch.find({})
      .sort({ fixtureDate: -1, scheduledAt: -1, createdAt: -1 })
      .limit(100)
      .populate("clubAId", "name status")
      .populate("clubBId", "name status")
      .lean();
    return res.json(matches);
  } catch (error) {
    console.error("Load all Club Matches admin directory error:", error);
    return res.status(500).json({ message: "Failed to load Club Match directory." });
  }
});

async function buildAdminApplicationSnapshot(application) {
  const memberIds = (application.memberIds || []).map(id => String(id));
  const memberPlayers = memberIds.length
    ? await Player.find({ _id: { $in: memberIds } })
        .select("_id name position profileImage jerseyNumber")
        .lean()
    : [];
  const playersById = new Map(memberPlayers.map(player => [String(player._id), player]));
  const ovrByPlayerId = memberIds.length ? await calculateClubOVRs(memberIds) : new Map();

  return {
    ...application,
    memberCount: memberIds.length,
    members: memberIds.map(id => ({
      ...playersById.get(id),
      ovr: Number(ovrByPlayerId.get(id) || 0) || null,
    })),
  };
}

router.get("/admin/applications", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const applications = await ClubFormationApplication.find({
      status: { $in: ["pendingCaptainDetailsApproval", "pendingAdminApproval"] },
    }).sort({ createdAt: 1 });

    for (const application of applications) {
      await normalizeLegacyFormationStage(application);
    }

    const readyForAdmin = applications
      .filter(application => application.status === "pendingAdminApproval" && captainDetailsAreApproved(application))
      .map(application => application.toObject());
    return res.json(await Promise.all(readyForAdmin.map(buildAdminApplicationSnapshot)));
  } catch (error) {
    console.error("Load Clubs admin applications error:", error);
    return res.status(500).json({ message: "Failed to load Club applications." });
  }
});

router.post("/admin/applications/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const application = await ClubFormationApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Club formation application not found." });
    await normalizeLegacyFormationStage(application);
    if (application.status !== "pendingAdminApproval" || !captainDetailsAreApproved(application)) {
      return res.status(409).json({ message: "Only fully captain-approved applications can be rejected at admin review." });
    }
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A rejection reason is required." });
    const previousStatus = application.status;
    application.rejectionReason = reason;
    application.status = "rejected";
    await application.save();
    await writeClubAdminAudit(req, {
      action: "formation-reject",
      entityType: "formation",
      entityId: application._id,
      previousStatus,
      nextStatus: application.status,
      outcome: "success",
      reason,
    });
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
      if (application.status !== "pendingAdminApproval") throw new Error("Club details must be approved by all elected captains before admin approval.");
      if (!captainDetailsAreApproved(application)) throw new Error("Every elected captain must approve non-empty Club details before admin approval.");
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
      await ClubWalletTransaction.create([{
        clubId: club._id,
        type: "starting_balance",
        amount: CLUB_STARTING_BALANCE,
        balanceAfter: CLUB_STARTING_BALANCE,
        description: "Club starting balance.",
        idempotencyKey: `club-starting-balance:${club._id}`,
      }], { session });
      await ClubHistory.create([{ clubId: club._id, eventType: "formed", description: "Club approved and officially formed.", metadata: { formationApplicationId: application._id } }, { clubId: club._id, eventType: "adminApproved", description: "Club application approved by admin." }], { session, ordered: true });
      application.status = "approved";
      application.approvedClubId = club._id;
      application.rejectionReason = "";
      await application.save({ session });
      createdClub = club;
    });
    await writeClubAdminAudit(req, {
      action: "formation-approve",
      entityType: "formation",
      entityId: createdClub?._id || new mongoose.Types.ObjectId(req.params.id),
      clubId: createdClub?._id || null,
      previousStatus: "pendingAdminApproval",
      nextStatus: "approved",
      outcome: "success",
      reason: "Administrator approved a fully captain-approved Club formation.",
    });
    return res.status(201).json(createdClub);
  } catch (error) {
    await writeClubAdminAudit(req, {
      action: "formation-approve",
      entityType: "formation",
      entityId: new mongoose.Types.ObjectId(req.params.id),
      previousStatus: "pendingAdminApproval",
      nextStatus: "pendingAdminApproval",
      outcome: "failed",
      reason: String(error?.message || "Formation approval failed").slice(0, 500),
    });
    console.error("Club application approval error:", error);
    return res.status(400).json({ message: error.message || "Failed to approve the club application." });
  } finally {
    await session.endSession();
  }
});


const OPERATIONS_DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_FORMATION_STATUSES = [
  "pendingMutualAgreement", "pendingName", "pendingCaptainVoteSetup",
  "captainVote", "pendingCaptainDetailsApproval", "pendingAdminApproval",
];

function boundedPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function operationsAgeHours(value, now = new Date()) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now.getTime() - timestamp) / 3_600_000)) : null;
}

function operationsQueueItem({
  type, severity = "info", entityType, entityId, title, subtitle = "",
  detail = "", status = "", createdAt = null, updatedAt = null, dueAt = null,
  target = "adminDashboard", nextAction = "Inspect record", action = null, metadata = {},
}, now = new Date()) {
  return {
    id: `${type}:${String(entityId)}`,
    type, severity, entityType, entityId: String(entityId), title, subtitle, detail,
    status, createdAt, updatedAt,
    ageHours: operationsAgeHours(createdAt, now),
    dueAt,
    target, nextAction, action,
    metadata,
  };
}

async function writeClubAdminAudit(req, event) {
  try {
    await ClubAdminAuditEvent.create({
      actorUserId: req.user?._id || null,
      actorName: String(req.user?.name || req.user?.email || "Administrator").slice(0, 120),
      actorEmail: String(req.user?.email || "").slice(0, 254),
      actorRole: "admin",
      requestId: String(req.requestId || "").slice(0, 80),
      ...event,
    });
  } catch (error) {
    // Auditing failures must never roll back or change the result of a business
    // operation; emit only a correlation-safe event without payloads or secrets.
    console.error("Clubs administrator audit write failed", {
      requestId: req.requestId || "",
      action: event?.action || "unknown",
      entityType: event?.entityType || "unknown",
    });
  }
}

async function loadClubOperationsData(now = new Date()) {
  const sevenDays = new Date(now.getTime() + 7 * OPERATIONS_DAY_MS);
  const thirtyDays = new Date(now.getTime() + 30 * OPERATIONS_DAY_MS);
  const oneDay = new Date(now.getTime() + OPERATIONS_DAY_MS);
  const staleCutoff = new Date(now.getTime() - 7 * OPERATIONS_DAY_MS);
  const [
    totalClubs, activeClubs, archivedClubs, pendingApplications,
    formationRows, contractsExpiring, activeOffers, syncJobs, pendingSettlementRows,
    pendingMatchRows, allClubs, walletMismatchResult, recentErrors,
    captainAndMemberDecisionsCount, contractsExpiring7DaysCount, offersExpiring24HoursCount,
    syncIssuesCount, pendingSettlementsCount, staleFormationsCount, staleSyncCount,
  ] = await Promise.all([
    Club.countDocuments({}),
    Club.countDocuments({ status: "approved" }),
    Club.countDocuments({ status: "archived" }),
    ClubFormationApplication.countDocuments({ status: "pendingAdminApproval", details: { $type: "string", $ne: "" } }),
    ClubFormationApplication.find({ status: { $in: ACTIVE_FORMATION_STATUSES } })
      .sort({ createdAt: 1 }).limit(100).lean(),
    ClubContract.find({ status: "active", endAt: { $gt: now, $lte: thirtyDays } })
      .sort({ endAt: 1 }).limit(100).lean(),
    AuctionOffer.find({
      status: { $in: ["active", "chosenByPlayer"] },
      $or: [
        { expiresAt: { $lte: oneDay } },
        { status: "chosenByPlayer" },
        { expiresAt: null },
      ],
    }).sort({ expiresAt: 1, createdAt: 1 }).limit(100).lean(),
    ClubSyncJob.find({
      $or: [
        { status: "pending", $or: [{ lastError: { $nin: ["", null] } }, { nextAttemptAt: { $lte: now } }] },
        { status: "processing", lockedUntil: { $lte: now } },
      ],
    }).sort({ nextAttemptAt: 1, createdAt: 1 }).limit(100).lean(),
    ClubMatch.find({ status: "completed", mainMatchId: { $ne: null }, settlementStatus: { $ne: "settled" } })
      .sort({ updatedAt: 1 }).limit(100).lean(),
    ClubMatch.find({
      $or: [
        { status: "requested" },
        { status: "accepted", scheduledAt: { $lt: now }, mainMatchId: null },
      ],
    }).sort({ scheduledAt: 1, createdAt: 1 }).limit(100).lean(),
    Club.find({}).select("_id name balance committedBalance status updatedAt").sort({ updatedAt: -1 }).limit(500).lean(),
    Club.aggregate([
      { $lookup: {
        from: AuctionOffer.collection.name,
        let: { targetClubId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$clubId", "$targetClubId"] },
            { $or: [
              { $and: [{ $eq: ["$status", "active"] }, { $gt: ["$expiresAt", now] }] },
              { $eq: ["$status", "chosenByPlayer"] },
            ] },
          ] } } },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ],
        as: "reservedOfferTotals",
      } },
      { $addFields: {
        expectedCommittedBalance: { $round: [{ $ifNull: [{ $arrayElemAt: ["$reservedOfferTotals.amount", 0] }, 0] }, 2] },
        storedCommittedBalance: { $round: [{ $ifNull: ["$committedBalance", 0] }, 2] },
      } },
      { $match: { $expr: { $gt: [{ $abs: { $subtract: ["$storedCommittedBalance", "$expectedCommittedBalance"] } }, 0.001] } } },
      { $facet: {
        items: [
          { $sort: { updatedAt: -1 } },
          { $limit: 100 },
          { $project: {
            _id: 1, name: 1, balance: 1, status: 1, updatedAt: 1,
            committedBalance: "$storedCommittedBalance",
            expectedCommittedBalance: "$expectedCommittedBalance",
          } },
        ],
        counts: [{ $count: "total" }],
      } },
    ]),
    ClubAdminAuditEvent.find({ outcome: "failed", createdAt: { $gte: new Date(now.getTime() - 7 * OPERATIONS_DAY_MS) } })
      .sort({ createdAt: -1 }).limit(20).lean(),
    ClubFormationApplication.countDocuments({ status: { $in: ACTIVE_FORMATION_STATUSES.filter(status => status !== "pendingAdminApproval") } }),
    ClubContract.countDocuments({ status: "active", endAt: { $gt: now, $lte: sevenDays } }),
    AuctionOffer.countDocuments({
      status: { $in: ["active", "chosenByPlayer"] },
      $or: [{ status: "chosenByPlayer" }, { status: "active", expiresAt: { $lte: oneDay } }, { status: "active", expiresAt: null }],
    }),
    ClubSyncJob.countDocuments({
      $or: [
        { status: "pending", $or: [{ lastError: { $nin: ["", null] } }, { nextAttemptAt: { $lte: now } }] },
        { status: "processing", lockedUntil: { $lte: now } },
      ],
    }),
    ClubMatch.countDocuments({ status: "completed", mainMatchId: { $ne: null }, settlementStatus: { $ne: "settled" } }),
    ClubFormationApplication.countDocuments({ status: { $in: ACTIVE_FORMATION_STATUSES }, createdAt: { $lte: staleCutoff } }),
    ClubSyncJob.countDocuments({
      updatedAt: { $lte: staleCutoff },
      $or: [
        { status: "pending", $or: [{ lastError: { $nin: ["", null] } }, { nextAttemptAt: { $lte: now } }] },
        { status: "processing" },
      ],
    }),
  ]);

  const clubsById = new Map(allClubs.map(club => [String(club._id), club]));
  const walletMismatchDoc = walletMismatchResult[0] || {};
  const walletMismatchRows = walletMismatchDoc.items || [];
  const walletMismatchCount = Number(walletMismatchDoc.counts?.[0]?.total || 0);
  const queue = [];

  for (const application of formationRows) {
    // Admin action is only permitted once the existing workflow reaches the
    // canonical pendingAdminApproval state; earlier stages remain informational.
    const readyForAdmin = application.status === "pendingAdminApproval" &&
      captainDetailsAreApproved(application);
    if (application.status === "pendingAdminApproval" && !readyForAdmin) continue;
    const age = operationsAgeHours(application.createdAt, now);
    const waitingForMember = application.status === "pendingMutualAgreement";
    queue.push(operationsQueueItem({
      type: "formation",
      severity: readyForAdmin ? "high" : age >= 24 * 7 ? "high" : age >= 24 ? "warning" : "info",
      entityType: "formation",
      entityId: application._id,
      title: application.proposedName || "Unnamed Club formation",
      subtitle: `${application.memberIds?.length || 0} selected members · ${statusLabelForOperations(application.status)}`,
      detail: readyForAdmin
        ? "All required captain details approvals are recorded. An administrator can review and approve or reject with a reason."
        : waitingForMember
          ? "Member invitation responses are outstanding; no administrator approval action is available at this stage."
          : "The formation workflow is awaiting a member or captain action.",
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      target: readyForAdmin ? "adminApplications" : "adminDashboard",
      nextAction: readyForAdmin ? "Review application" : "Inspect formation progress",
      action: readyForAdmin ? "review-formation" : null,
      metadata: { pendingMembers: (application.memberApprovals || []).filter(item => item.status === "pending").length },
    }, now));
    if (readyForAdmin) continue;
  }

  for (const contract of contractsExpiring) {
    const club = clubsById.get(String(contract.clubId));
    const remainingHours = Math.floor((new Date(contract.endAt).getTime() - now.getTime()) / 3_600_000);
    queue.push(operationsQueueItem({
      type: "contract",
      severity: remainingHours <= 24 ? "high" : remainingHours <= 72 ? "warning" : "info",
      entityType: "club",
      entityId: contract.clubId,
      title: club?.name || "Club contract renewal",
      subtitle: `Contract expires ${new Date(contract.endAt).toISOString()}`,
      detail: "An active player contract is approaching its existing renewal boundary; inspect the Club and current renewal decision before taking action.",
      status: "active",
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      dueAt: contract.endAt,
      target: "adminClubs",
      nextAction: "Review Club contracts",
      metadata: { playerId: String(contract.playerId), contractId: String(contract._id), contractEndAt: contract.endAt },
    }, now));
  }

  for (const offer of activeOffers) {
    const club = clubsById.get(String(offer.clubId));
    const remaining = offer.expiresAt ? new Date(offer.expiresAt).getTime() - now.getTime() : null;
    const expired = remaining !== null && remaining <= 0;
    const chosen = offer.status === "chosenByPlayer";
    queue.push(operationsQueueItem({
      type: "auction",
      severity: chosen ? (operationsAgeHours(offer.playerChosenAt || offer.updatedAt, now) >= 48 ? "high" : "warning")
        : expired ? "high" : remaining !== null && remaining <= 6 * 60 * 60 * 1000 ? "warning" : "info",
      entityType: "auctionOffer",
      entityId: offer._id,
      title: `${club?.name || "Club"} signing offer · ${offer.amount} credits`,
      subtitle: chosen ? "Player selected · captain approval is required" : expired ? "Offer expired · maintenance should release its reservation" : "Offer nearing expiry",
      detail: chosen
        ? "The player's offer selection is persisted. Review captain approval state; settlement remains governed by the canonical auction service."
        : expired ? "This offer is past its stored expiry but is still in an active state. Check maintenance and reservation reconciliation."
          : "This active offer is approaching its stored expiration time.",
      status: offer.status,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      dueAt: offer.expiresAt,
      target: "adminDashboard",
      nextAction: chosen ? "Inspect signing approvals" : "Inspect offer and reserved budget",
      metadata: { clubId: String(offer.clubId), playerId: String(offer.playerId), amount: offer.amount },
    }, now));
  }

  for (const job of syncJobs) {
    const age = operationsAgeHours(job.updatedAt || job.createdAt, now);
    queue.push(operationsQueueItem({
      type: "sync",
      severity: job.lastError ? (age >= 24 ? "critical" : "high") : "warning",
      entityType: "syncJob",
      entityId: job._id,
      title: "Matchday → Clubs synchronization needs attention",
      subtitle: `Main match ${String(job.mainMatchId)} · ${job.attempts || 0} attempts`,
      detail: job.lastError || (job.status === "processing" ? "Sync lock appears stale; the canonical worker can safely reclaim it after lock expiry." : "Sync is pending its next eligible retry."),
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      dueAt: job.nextAttemptAt,
      target: "adminMatches",
      nextAction: job.lastError ? "Inspect or retry synchronization" : "Inspect synchronization",
      action: job.lastError ? "retry-sync" : null,
      metadata: { mainMatchId: String(job.mainMatchId), attempts: job.attempts || 0, nextAttemptAt: job.nextAttemptAt },
    }, now));
  }

  for (const match of pendingSettlementRows) {
    const age = operationsAgeHours(match.updatedAt || match.createdAt, now);
    queue.push(operationsQueueItem({
      type: "settlement",
      severity: age >= 24 ? "critical" : age >= 2 ? "high" : "warning",
      entityType: "clubMatch",
      entityId: match._id,
      title: "Completed Club Match awaits settlement",
      subtitle: `Fixture ${match.fixtureDate || match.scheduledAt}`,
      detail: "A completed Club Match has a linked main Match Record but the canonical settlement flag is not settled. Review the match before invoking the idempotent settlement service.",
      status: match.settlementStatus || "pending",
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      target: "adminMatches",
      nextAction: "Review settlement",
      action: "settle-match",
      metadata: { mainMatchId: String(match.mainMatchId), clubAId: String(match.clubAId), clubBId: String(match.clubBId) },
    }, now));
  }

  for (const match of pendingMatchRows) {
    const pastFixture = match.status === "accepted" && new Date(match.scheduledAt).getTime() < now.getTime();
    const age = operationsAgeHours(match.createdAt, now);
    queue.push(operationsQueueItem({
      type: "match",
      severity: pastFixture ? "high" : age >= 24 * 3 ? "warning" : "info",
      entityType: "clubMatch",
      entityId: match._id,
      title: pastFixture ? "Accepted fixture has no linked Matchday result" : "Club Match request is still open",
      subtitle: `Fixture ${match.fixtureDate || match.scheduledAt}`,
      detail: pastFixture
        ? "The fixture date has passed and no main Match Record is linked. Verify the real match record before attempting a synchronization."
        : "A fixture request remains in the requested state; the response remains the responsibility of the receiving Club's captains.",
      status: match.status,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      dueAt: match.scheduledAt,
      target: "adminMatches",
      nextAction: "Inspect fixture",
      metadata: { clubAId: String(match.clubAId), clubBId: String(match.clubBId), mainMatchId: match.mainMatchId ? String(match.mainMatchId) : null },
    }, now));
  }

  for (const club of walletMismatchRows) {
    const expected = Number(club.expectedCommittedBalance || 0);
    const committed = Number(club.committedBalance || 0);
    queue.push(operationsQueueItem({
      type: "wallet-discrepancy",
      severity: Number(club.balance || 0) < expected ? "critical" : "high",
      entityType: "wallet",
      entityId: club._id,
      title: `${club.name || "Club"} reservation discrepancy`,
      subtitle: `Committed ${committed} · expected ${expected} credits`,
      detail: Number(club.balance || 0) < expected
        ? "Reserved signing offers exceed the stored Club balance. Do not apply a manual correction from the dashboard; inspect offer and wallet ledgers first."
        : "Stored committed balance differs from active/chosen offers. The maintenance reconciliation is canonical; inspect the related offers and wallet ledger first.",
      status: "mismatch",
      createdAt: club.updatedAt,
      updatedAt: club.updatedAt,
      target: "adminClubs",
      nextAction: "Inspect Club wallet and offers",
      metadata: { clubId: String(club._id), balance: Number(club.balance || 0), committedBalance: committed, expectedCommittedBalance: expected },
    }, now));
  }

  for (const event of recentErrors) {
    queue.push(operationsQueueItem({
      type: "admin-error",
      severity: "high",
      entityType: event.entityType,
      entityId: event.entityId,
      title: `Recent administrator action failed: ${event.action}`,
      subtitle: event.reason || "An administrator action was recorded as failed.",
      detail: "Review the audit event and underlying record. No automatic repair was applied.",
      status: event.outcome,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      target: "adminDashboard",
      nextAction: "Inspect audit history",
      metadata: { auditEventId: String(event._id), requestId: event.requestId || "" },
    }, now));
  }

  const staleFormations = staleFormationsCount;
  const staleSyncJobs = staleSyncCount;

  queue.sort((a, b) => {
    const severityWeight = { critical: 0, high: 1, warning: 2, info: 3 };
    return severityWeight[a.severity] - severityWeight[b.severity]
      || (new Date(a.dueAt || a.createdAt || now).getTime() - new Date(b.dueAt || b.createdAt || now).getTime());
  });

  return {
    now,
    queue,
    counts: {
      totalClubs,
      activeClubs,
      archivedClubs,
      pendingApplications,
      captainAndMemberDecisions: captainAndMemberDecisionsCount,
      contractsExpiring7Days: contractsExpiring7DaysCount,
      offersExpiring24Hours: offersExpiring24HoursCount,
      syncFailures: syncIssuesCount,
      pendingSettlements: pendingSettlementsCount,
      walletDiscrepancies: walletMismatchCount,
      staleWorkflows: staleFormations + staleSyncJobs,
      recentCriticalErrors: recentErrors.length,
      upcomingMatches: await ClubMatch.countDocuments({ status: { $in: ["requested", "accepted"] } }),
      completedMatches: await ClubMatch.countDocuments({ status: "completed" }),
    },
    queue,
  };
}

function statusLabelForOperations(status) {
  return ({
    pendingMutualAgreement: "waiting for member responses",
    pendingName: "awaiting permanent name",
    pendingCaptainVoteSetup: "captain vote setup",
    captainVote: "captain election in progress",
    pendingCaptainDetailsApproval: "waiting for captain details approval",
    pendingAdminApproval: "waiting for administrator approval",
    approved: "approved",
    rejected: "rejected",
  })[status] || String(status || "unknown");
}

function normalizeOperationsFilter(value, allowed, fallback = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

router.get("/admin/operations/summary", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const data = await loadClubOperationsData();
    return res.json({
      success: true,
      generatedAt: data.now.toISOString(),
      counts: data.counts,
      queueCount: data.queue.length,
      queueBySeverity: {
        critical: data.queue.filter(item => item.severity === "critical").length,
        high: data.queue.filter(item => item.severity === "high").length,
        warning: data.queue.filter(item => item.severity === "warning").length,
        info: data.queue.filter(item => item.severity === "info").length,
      },
      telemetry: {
        source: "persisted-clubs-records",
        auditCoverageSince: "administrator actions recorded after this feature is deployed",
        syncHistoryAvailable: true,
        providerHealth: "not-instrumented-in-this-subsystem",
      },
    });
  } catch (error) {
    console.error("Clubs operations summary failed", { requestId: req.requestId || "" });
    return res.status(500).json({ success: false, message: "Could not load Clubs operations summary." });
  }
});

router.get("/admin/operations/queue", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const limit = boundedPositiveInt(req.query.limit, 25, 100);
  const page = boundedPositiveInt(req.query.page, 1, 100_000);
  const validTypes = ["formation", "contract", "auction", "sync", "settlement", "match", "wallet-discrepancy", "admin-error"];
  const validSeverities = ["critical", "high", "warning", "info"];
  const type = normalizeOperationsFilter(req.query.type, validTypes);
  const severity = normalizeOperationsFilter(req.query.severity, validSeverities);
  const status = String(req.query.status || "").trim().slice(0, 80);
  const search = String(req.query.search || "").trim().toLowerCase().slice(0, 120);
  const sort = normalizeOperationsFilter(req.query.sort, ["priority", "oldest", "newest", "due"], "priority");
  try {
    const data = await loadClubOperationsData();
    let items = data.queue;
    if (type) items = items.filter(item => item.type === type);
    if (severity) items = items.filter(item => item.severity === severity);
    if (status) items = items.filter(item => item.status.toLowerCase() === status.toLowerCase());
    if (search) items = items.filter(item => [item.title, item.subtitle, item.detail, item.entityId].some(value => String(value || "").toLowerCase().includes(search)));
    if (sort === "oldest") items = [...items].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    if (sort === "newest") items = [...items].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    if (sort === "due") items = [...items].sort((a, b) => new Date(a.dueAt || "9999-12-31") - new Date(b.dueAt || "9999-12-31"));
    return res.json({
      success: true,
      generatedAt: data.now.toISOString(),
      pagination: { page, limit, total: items.length, pages: Math.max(1, Math.ceil(items.length / limit)) },
      filters: { type, severity, status, search, sort },
      items: items.slice((page - 1) * limit, page * limit),
    });
  } catch (error) {
    console.error("Clubs operations queue failed", { requestId: req.requestId || "" });
    return res.status(500).json({ success: false, message: "Could not load Clubs operations queue." });
  }
});

router.get("/admin/operations/activity", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const limit = boundedPositiveInt(req.query.limit, 20, 50);
  const page = boundedPositiveInt(req.query.page, 1, 100_000);
  const types = ["formation", "club", "clubMatch", "auctionOffer", "wallet", "syncJob"];
  const entityType = normalizeOperationsFilter(req.query.entityType, types);
  const outcome = normalizeOperationsFilter(req.query.outcome, ["success", "failed", "requested"]);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  if (before && !Number.isFinite(before.getTime())) return res.status(400).json({ success: false, message: "Invalid activity cursor." });
  const dateFilter = before ? { $lt: before } : { $exists: true };
  try {
    const eventFilter = {
      ...(entityType ? { entityType } : {}),
      ...(outcome ? { outcome } : {}),
      createdAt: dateFilter,
    };
    const historyFilter = {
      createdAt: dateFilter,
      ...(entityType === "clubMatch" ? { eventType: "matchPlayed" } : {}),
    };
    const [auditEvents, historyEvents] = await Promise.all([
      ClubAdminAuditEvent.find(eventFilter).sort({ createdAt: -1, _id: -1 }).limit(Math.min(150, limit * page)).lean(),
      ClubHistory.find(historyFilter).sort({ createdAt: -1, _id: -1 }).limit(Math.min(150, limit * page)).lean(),
    ]);
    const normalizedAudit = auditEvents.map(event => ({
      id: String(event._id), source: "admin-audit", action: event.action,
      actor: event.actorName || "Administrator", actorRole: event.actorRole || "admin",
      entityType: event.entityType, entityId: String(event.entityId), clubId: event.clubId ? String(event.clubId) : null,
      previousStatus: event.previousStatus || "", nextStatus: event.nextStatus || "",
      outcome: event.outcome, reason: event.reason || "", requestId: event.requestId || "",
      createdAt: event.createdAt, updatedAt: event.updatedAt,
    }));
    const normalizedHistory = historyEvents.map(event => ({
      id: String(event._id), source: "club-history", action: event.eventType,
      actor: "Recorded Club history", actorRole: "system", entityType: "club",
      entityId: String(event.clubId), clubId: String(event.clubId),
      previousStatus: "", nextStatus: "", outcome: "success",
      reason: event.description || "", requestId: "", createdAt: event.createdAt || event.occurredAt, updatedAt: event.updatedAt,
    }));
    const merged = [...normalizedAudit, ...normalizedHistory]
      .filter(event => !entityType || event.entityType === entityType)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, Math.min(150, limit * page));
    const items = merged.slice((page - 1) * limit, page * limit);
    return res.json({
      success: true,
      pagination: { page, limit, totalReturned: merged.length, hasMore: merged.length === Math.min(150, limit * page) },
      nextBefore: items.length ? new Date(items[items.length - 1].createdAt).toISOString() : null,
      items,
      coverage: { audit: "Administrator actions recorded after deployment of this feature", history: "Persisted ClubHistory records only; missing older actions are not reconstructed" },
    });
  } catch (error) {
    console.error("Clubs operations activity failed", { requestId: req.requestId || "" });
    return res.status(500).json({ success: false, message: "Could not load Clubs activity." });
  }
});

router.post("/admin/operations/sync/:jobId/retry", requireAuth, requireAdmin, async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(400).json({ success: false, message: "Invalid sync job id." });
  try {
    const job = await ClubSyncJob.findById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: "Sync job not found." });
    if (job.status === "completed") return res.status(409).json({ success: false, message: "Completed sync jobs cannot be retried." });
    if (job.status === "processing" && job.lockedUntil && new Date(job.lockedUntil).getTime() > Date.now()) {
      return res.status(409).json({ success: false, message: "The sync worker currently holds this job. Try again after its lock expires." });
    }
    const beforeStatus = job.status;
    await ClubSyncJob.updateOne(
      { _id: job._id, status: { $in: ["pending", "processing"] } },
      { $set: { status: "pending", nextAttemptAt: new Date(), lockedUntil: null } },
    );
    const result = await processClubSyncJob({ _id: job._id });
    await writeClubAdminAudit(req, {
      action: "sync-retry",
      entityType: "syncJob",
      entityId: job._id,
      previousStatus: beforeStatus,
      nextStatus: result?.completed ? "completed" : "pending",
      outcome: result?.completed ? "success" : "failed",
      reason: result?.error ? String(result.error).slice(0, 500) : "Administrator invoked the canonical Club sync worker.",
    });
    return res.json({ success: Boolean(result?.completed), result: { completed: Boolean(result?.completed), skipped: Boolean(result?.skipped) }, message: result?.completed ? "Club synchronization completed." : "Club synchronization remains pending; inspect the updated error before retrying again." });
  } catch (error) {
    await writeClubAdminAudit(req, {
      action: "sync-retry",
      entityType: "syncJob",
      entityId: new mongoose.Types.ObjectId(req.params.jobId),
      outcome: "failed",
      reason: String(error?.message || "Retry failed").slice(0, 500),
    });
    return res.status(500).json({ success: false, message: "Could not retry Club synchronization." });
  }
});


export default router;
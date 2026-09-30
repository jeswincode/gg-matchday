import express from "express";
import mongoose from "mongoose";
import Club from "../models/clubs/Club.js";
import { CLUB_FORMATIONS, CLUB_MAX_MEMBERS, CLUB_STARTING_BALANCE } from "../config/clubsRules.js";
import { pingClubsDatabase, getClubsConnection } from "../config/clubsDatabase.js";

const router = express.Router();

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
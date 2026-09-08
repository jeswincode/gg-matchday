import Player from "../models/Player.js";
import Match from "../models/Match.js";
import mongoose from "mongoose";
import express from "express";

import Gallery from "../models/Gallery.js";

import {
  requireAuth,
} from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// GET GALLERY
// PUBLIC
// ==========================================

router.get(
  "/",
  async (req, res) => {
    try {
      const photos = await Gallery.find()
        .select(
          "imageUrl caption uploadedBy uploadedByName matchId playerId playerIds createdAt"
        )
        .populate(
          "matchId",
          "name date teamA teamB"
        )
        .populate(
          "playerId",
          "name profileImage"
        )
        .populate("playerIds", "name")
        .sort({ createdAt: -1 })
        .skip(Math.max(0,(Number(req.query.page)||1)-1)*24).limit(24)
        .lean();

      res.set(
        "Cache-Control",
        "public, max-age=10, stale-while-revalidate=30"
      );

      const total = await Gallery.countDocuments();
      res.json(req.query.page ? {items:photos,total,nextPage:(Number(req.query.page)||1)*24<total?(Number(req.query.page)||1)+1:null}:photos);
    } catch (error) {
      console.error(
        "Gallery fetch error:",
        error
      );

      res.status(500).json({
        message: "Failed to load gallery.",
      });
    }
  }
);

// ==========================================
// ADD PHOTO
// SIGNED-IN USERS
// ==========================================

router.post(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const {
        imageUrl,
        caption,
        matchId,
        playerId,
      } = req.body;

      if (
        !imageUrl ||
        typeof imageUrl !== "string"
      ) {
        return res.status(400).json({
          message: "Image URL is required.",
        });
      }

      let url; try { url = new URL(imageUrl); } catch { return res.status(400).json({message:"Invalid image URL."}); }
      if (url.protocol!=="https:" || url.hostname!=="res.cloudinary.com") return res.status(400).json({message:"Use an uploaded Cloudinary image."});
      const playerIds=[...new Set(req.body.playerIds || (playerId?[playerId]:[]))];
      if(playerIds.length>30||playerIds.some(id=>!mongoose.isValidObjectId(id))||await Player.countDocuments({_id:{$in:playerIds}})!==playerIds.length) return res.status(400).json({message:"Choose valid players."});
      if(matchId&&(!mongoose.isValidObjectId(matchId)||!await Match.exists({_id:matchId})))return res.status(400).json({message:"Choose a valid match."});
      const photo = await Gallery.create({
        playerIds,
        imageUrl: imageUrl.trim(),
        caption:
          typeof caption === "string"
            ? caption.trim()
            : "",
        uploadedBy: req.user._id,
        uploadedByName: req.user.name || "",
        uploadedByEmail: req.user.email || "",
        matchId: matchId || null,
        playerId: playerId || null,
      });

      res.status(201).json(photo);
    } catch (error) {
      console.error(
        "Gallery upload error:",
        error
      );

      res.status(500).json({
        message: "Failed to save gallery photo.",
      });
    }
  }
);

// ==========================================
// DELETE PHOTO
// ADMIN / EDITOR
// ==========================================

router.delete(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const user = req.user;

      const photo = await Gallery.findById(
        req.params.id
      );

      if (!photo) {
        return res.status(404).json({
          message: "Photo not found.",
        });
      }

      const isAdmin = user.role === "admin";
      const isOwner =
        String(photo.uploadedBy) === String(user._id);
      const isEditor = user.role === "editor";

      if (!isAdmin && !(isEditor && isOwner)) {
        return res.status(403).json({
          message:
            "You do not have permission to delete this photo.",
        });
      }

      await Gallery.findByIdAndDelete(req.params.id);

      res.json({
        message: "Photo deleted.",
      });
    } catch (error) {
      console.error(
        "Gallery delete error:",
        error
      );

      res.status(500).json({
        message: "Failed to delete photo.",
      });
    }
  }
);

export default router;

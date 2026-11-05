import { AVATAR_OPTIONS } from "../../../shared/worldCustomization.js";
import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const appearanceSchema = new mongoose.Schema({
  skinTone: { type: String, enum: AVATAR_OPTIONS.skinTone, default: "medium" },
  bodyType: { type: String, enum: AVATAR_OPTIONS.bodyType, default: "athletic" },
  hairStyle: { type: String, enum: AVATAR_OPTIONS.hairStyle, default: "short" },
  hairColor: { type: String, enum: AVATAR_OPTIONS.hairColor, default: "black" },
  kitPrimary: { type: String, enum: AVATAR_OPTIONS.kitPrimary, default: "black" },
  kitSecondary: { type: String, enum: AVATAR_OPTIONS.kitSecondary, default: "gold" },
  bootColor: { type: String, enum: AVATAR_OPTIONS.bootColor, default: "white" },
  headAccessory: { type: String, enum: AVATAR_OPTIONS.headAccessory, default: "none" },
}, { _id: false });

const playerAvatarSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true, index: true },
    displayName: { type: String, trim: true, maxlength: 24, default: "" },
    appearance: { type: appearanceSchema, default: () => ({}) },
    tutorialComplete: { type: Boolean, default: false },
    equippedCosmetics: { type: [String], default: [] },
    presets: { type: [{ name: { type: String, trim: true, maxlength: 24, required: true }, appearance: { type: appearanceSchema, required: true }, savedAt: { type: Date, default: Date.now } }], default: [] },
  },
  { timestamps: true, collection: "playerAvatars" },
);

export default getClubsConnection().model("PlayerAvatar", playerAvatarSchema);

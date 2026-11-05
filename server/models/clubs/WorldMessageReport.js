import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldMessageReportSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "WorldMessage", required: true, index: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  reason: { type: String, enum: ["spam", "harassment", "inappropriate", "other"], default: "other" },
}, { timestamps: true, collection: "worldMessageReports" });

worldMessageReportSchema.index({ messageId: 1, playerId: 1 }, { unique: true });
export default getClubsConnection().model("WorldMessageReport", worldMessageReportSchema);

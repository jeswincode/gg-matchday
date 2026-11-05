import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubAdminAuditEventSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorName: { type: String, trim: true, maxlength: 120, default: "Administrator" },
    actorEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    actorRole: { type: String, enum: ["admin", "system"], default: "admin" },
    action: { type: String, trim: true, required: true, maxlength: 80 },
    entityType: {
      type: String,
      enum: ["formation", "club", "clubMatch", "auctionOffer", "wallet", "syncJob"],
      required: true,
      index: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    previousStatus: { type: String, trim: true, maxlength: 80, default: "" },
    nextStatus: { type: String, trim: true, maxlength: 80, default: "" },
    outcome: { type: String, enum: ["success", "failed", "requested"], default: "success" },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    requestId: { type: String, trim: true, maxlength: 80, default: "" },
  },
  { timestamps: true, collection: "clubAdminAuditEvents", versionKey: false },
);

clubAdminAuditEventSchema.index({ createdAt: -1, _id: -1 });
clubAdminAuditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export default getClubsConnection().model("ClubAdminAuditEvent", clubAdminAuditEventSchema);

import mongoose from "mongoose";
const { Schema } = mongoose;

const worldAccessGrantSchema = new Schema({
  worldId: { type: Schema.Types.ObjectId, ref: "World", required: true, index: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: /^[a-z0-9][a-z0-9.]{4,28}[a-z0-9]@gmail[.]com$/,
  },
  role: { type: String, enum: ["member", "editor", "viewer"], default: "member", required: true },
  status: { type: String, enum: ["invited", "active", "revoked"], default: "invited", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  activatedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, collection: "worldAccessGrants" });

worldAccessGrantSchema.index(
  { worldId: 1, email: 1 },
  { unique: true, name: "world_access_grant_world_email_unique" },
);
worldAccessGrantSchema.index({ worldId: 1, status: 1, updatedAt: -1 }, { name: "world_access_grant_status_updated" });
worldAccessGrantSchema.index({ userId: 1, status: 1 }, { name: "world_access_grant_user_status" });

export default mongoose.models.WorldAccessGrant ||
  mongoose.model("WorldAccessGrant", worldAccessGrantSchema);

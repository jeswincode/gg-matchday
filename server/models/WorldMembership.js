import mongoose from "mongoose";

const { Schema } = mongoose;

const worldMembershipSchema = new Schema({
  worldId: {
    type: Schema.Types.ObjectId,
    ref: "World",
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["owner", "admin", "editor", "member", "viewer"],
    default: "member",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "active", "rejected", "suspended", "left"],
    default: "pending",
    required: true,
    index: true,
  },
  playerProfileId: {
    type: Schema.Types.ObjectId,
    ref: "Player",
    default: null,
  },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  decisionNote: { type: String, trim: true, maxlength: 500, default: "" },
  lastActiveAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: "worldMemberships",
});

worldMembershipSchema.index(
  { worldId: 1, userId: 1 },
  { unique: true, name: "world_membership_user_unique" },
);
worldMembershipSchema.index(
  { worldId: 1, playerProfileId: 1 },
  {
    unique: true,
    name: "world_membership_player_profile_unique",
    partialFilterExpression: {
      playerProfileId: { $type: "objectId" },
    },
  },
);
worldMembershipSchema.index(
  { userId: 1, status: 1, updatedAt: -1 },
  { name: "world_membership_user_status" },
);
worldMembershipSchema.index(
  { worldId: 1, status: 1, createdAt: -1 },
  { name: "world_membership_review_queue" },
);

worldMembershipSchema.pre("validate", function validateMembershipState() {
  if (this.status === "active" && !this.approvedAt) {
    // Initial World owners also receive an activation timestamp at creation.
    // This avoids active memberships that cannot be audited.
    this.invalidate("approvedAt", "An active membership requires an approval or activation timestamp.");
  }
  if (this.status === "pending" && this.role !== "member" && this.role !== "viewer") {
    this.invalidate("role", "A pending membership cannot have an elevated World role.");
  }
});

export default mongoose.models.WorldMembership || mongoose.model("WorldMembership", worldMembershipSchema);

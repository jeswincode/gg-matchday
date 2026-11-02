import mongoose from "mongoose";

const PRIMARY_WORLD_SLUG = "original-gg";

export async function seedPrimaryWorldFixture({
  World,
  User,
  WorldMembership,
  WorldAccessGrant,
  users = [],
  slug = PRIMARY_WORLD_SLUG,
} = {}) {
  const owner = await User.findOneAndUpdate(
    { firebaseUid: "fixture:primary-world-owner" },
    {
      $setOnInsert: {
        firebaseUid: "fixture:primary-world-owner",
        name: "GG Test Platform Owner",
        email: "gg-fixture-owner@gmail.com",
        emailVerified: true,
        role: "viewer",
        platformRole: "user",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );

  let world = await World.findOne({ slug });
  if (!world) {
    world = await World.create({
      name: "Original GG",
      slug,
      description: "The one shared GG football World.",
      ownerUserId: owner._id,
      visibility: "public",
      joinPolicy: "approval",
      globalMap: { mapId: "gg-main-v1", slotIndex: 0, x: 0, y: 0 },
    });
  }

  const now = new Date();
  for (const entry of users) {
    const user = entry?.user || (entry?.userId
      ? await User.findById(entry.userId)
      : entry?.firebaseUid
        ? await User.findOne({ firebaseUid: entry.firebaseUid })
        : null);
    if (!user?._id) continue;

    const role = entry.role || "member";
    const membershipRole = entry.platformAdmin === true ? "owner" : role;
    await WorldMembership.findOneAndUpdate(
      { worldId: world._id, userId: user._id },
      {
        $set: {
          role: membershipRole,
          status: "active",
          approvedAt: now,
          approvedBy: owner._id,
          rejectedAt: null,
          rejectedBy: null,
          decisionNote: "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    const email = String(user.email || "").trim().toLowerCase();
    if (!email.endsWith("@gmail.com") || entry.platformAdmin === true) continue;
    await WorldAccessGrant.findOneAndUpdate(
      { worldId: world._id, email },
      {
        $set: {
          role,
          status: "active",
          userId: user._id,
          activatedAt: now,
          revokedAt: null,
          revokedBy: null,
        },
        $setOnInsert: { invitedBy: owner._id },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }

  return { world, owner };
}

export function fixtureObjectId() {
  return new mongoose.Types.ObjectId();
}

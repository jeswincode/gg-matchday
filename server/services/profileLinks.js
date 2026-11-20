export async function migrateV4ProfileLinks(connection) {
  if (connection.name !== "gg_matchday_v4") return;
  const users = connection.db.collection("users");
  try {
    const indexes = await users.indexes();
    const legacyIndex = indexes.find(index =>
      index.name === "user_playerProfile_unique" && index.unique && index.key.playerProfile === 1 &&
      Object.keys(index.key).length === 1,
    );
    if (legacyIndex) {
      await users.dropIndex(legacyIndex.name);
      console.info("Removed the legacy unique player-profile index in gg_matchday_v4.");
    }
  } catch (error) {
    // Both a fresh database and another V4 instance applying the migration are safe.
    if (error.code !== 26 && error.code !== 27) throw error;
  }
}

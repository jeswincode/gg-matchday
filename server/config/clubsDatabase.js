import mongoose from "mongoose";

let clubsConnection = null;

export function getClubsConnection() {
  if (!clubsConnection) {
    clubsConnection = mongoose.createConnection();
  }

  return clubsConnection;
}

export async function connectClubsDatabase() {
  const uri = String(process.env.CLUBS_MONGODB_URI || "").trim();

  if (!uri) {
    console.warn("Clubs MongoDB is not configured. Set CLUBS_MONGODB_URI to enable Clubs mode.");
    return null;
  }

  const connection = getClubsConnection();

  if (connection.readyState === 1) {
    return connection;
  }

  const dbName = String(process.env.CLUBS_DB_NAME || "").trim();

  await connection.openUri(uri, {
    ...(dbName ? { dbName } : {}),
    serverSelectionTimeoutMS: 10000,
  });

  console.log("Clubs MongoDB connected");
  return connection;
}

export async function pingClubsDatabase() {
  const connection = getClubsConnection();

  if (connection.readyState !== 1 || !connection.db) {
    return false;
  }

  await connection.db.admin().ping();
  return true;
}

export async function disconnectClubsDatabase() {
  if (!clubsConnection) return;
  await clubsConnection.close();
}
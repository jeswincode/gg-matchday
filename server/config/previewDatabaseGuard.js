function databaseNameFromUri(uri) {
  const value = String(uri || "").trim();
  if (!value) return "";
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("A valid MongoDB URI is required to verify V4 preview database isolation."); }
  return decodeURIComponent(parsed.pathname.replace(/^\/+/, "").split("/")[0] || "");
}

function validDatabaseName(value) {
  return /^[a-zA-Z0-9_-]{1,63}$/.test(String(value || ""));
}

/**
 * V4 preview runs as a second API process. It must never write to V3 databases.
 * Require explicit staging database names and prove they differ from both
 * configured V3 database names before opening either MongoDB connection.
 */
export function resolveV4PreviewDatabaseNames(env = process.env) {
  if (String(env.V4_PREVIEW_MODE || "").toLowerCase() !== "true") return null;

  const liveCore = String(env.V4_PREVIEW_SOURCE_CORE_DB_NAME || databaseNameFromUri(env.MONGODB_URI)).trim();
  const liveClubs = String(env.V4_PREVIEW_SOURCE_CLUBS_DB_NAME || env.CLUBS_DB_NAME || databaseNameFromUri(env.CLUBS_MONGODB_URI)).trim();
  const previewCore = String(env.V4_PREVIEW_CORE_DB_NAME || "").trim();
  const previewClubs = String(env.V4_PREVIEW_CLUBS_DB_NAME || "").trim();

  if (!liveCore || !liveClubs) {
    throw new Error("V4 preview is blocked: Core and Clubs source database names must be explicit before isolation can be checked.");
  }
  if (!validDatabaseName(previewCore) || !validDatabaseName(previewClubs)) {
    throw new Error("V4 preview is blocked: set valid V4_PREVIEW_CORE_DB_NAME and V4_PREVIEW_CLUBS_DB_NAME staging database names.");
  }

  const liveNames = new Set([liveCore, liveClubs]);
  if (liveNames.has(previewCore) || liveNames.has(previewClubs)) {
    throw new Error("V4 preview is blocked: staging database names must not match either V3 Core or Clubs database.");
  }
  if (previewCore === previewClubs) {
    throw new Error("V4 preview is blocked: Core and Clubs staging databases must be separate.");
  }

  return { coreDbName: previewCore, clubsDbName: previewClubs };
}

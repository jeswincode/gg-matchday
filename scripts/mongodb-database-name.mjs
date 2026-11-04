export function resolveMongoDatabaseName(uriValue, explicitName, label = "MongoDB") {
  const configuredName = String(explicitName || "").trim();
  if (configuredName) return configuredName;

  try {
    const uri = new URL(String(uriValue || "").trim());
    if (!["mongodb:", "mongodb+srv:"].includes(uri.protocol)) {
      throw new Error("Unsupported protocol");
    }
    const databaseName = decodeURIComponent(uri.pathname.replace(/^\/+/, "").split("/")[0] || "");
    if (databaseName) return databaseName;
  } catch {
    throw new Error(label + " URI is invalid or does not include a database name.");
  }

  throw new Error(label + " database name is missing. Set the explicit database name or include it in the URI path.");
}

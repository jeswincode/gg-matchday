import { readFileSync } from "node:fs";

const rawUri = readFileSync(0, "utf8").trim();
if (!rawUri) {
  console.error("MongoDB URI was not provided.");
  process.exit(2);
}

try {
  const uri = new URL(rawUri);
  if (!["mongodb:", "mongodb+srv:"].includes(uri.protocol)) {
    throw new Error("Unsupported protocol");
  }
  const databaseName = decodeURIComponent(uri.pathname.replace(/^\/+/, "").split("/")[0] || "");
  if (!databaseName) {
    throw new Error("No database path");
  }
  // Only print the database name; never print or log the supplied URI.
  process.stdout.write(databaseName + "\n");
} catch {
  console.error("Could not derive a database name from the MongoDB URI path.");
  process.exit(2);
}

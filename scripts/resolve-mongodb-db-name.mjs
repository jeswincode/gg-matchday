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
  // The app uses Mongo/Mongoose's "test" default when no URI database path
  // and no explicit dbName option are provided. Keep backup resolution aligned.
  process.stdout.write((databaseName || process.argv[2] || "test") + "\n");
} catch {
  console.error("Could not derive a database name from the MongoDB URI path.");
  process.exit(2);
}

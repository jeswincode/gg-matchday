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
  // Backups must never guess a database. A fallback is accepted only when
  // the operator passes it explicitly as the first CLI argument.
  const resolvedName = databaseName || process.argv[2] || "";
  if (!resolvedName) {
    console.error("MongoDB database name is missing. Set the explicit database name or include it in the URI path.");
    process.exit(2);
  }
  process.stdout.write(resolvedName + "\n");
} catch {
  console.error("Could not derive a database name from the MongoDB URI path.");
  process.exit(2);
}

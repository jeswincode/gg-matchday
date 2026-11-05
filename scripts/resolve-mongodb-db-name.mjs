import { readFileSync } from "node:fs";
import { resolveMongoDatabaseName } from "./mongodb-database-name.mjs";

const rawUri = readFileSync(0, "utf8").trim();
if (!rawUri) {
  console.error("MongoDB URI was not provided.");
  process.exit(2);
}

try {
  process.stdout.write(resolveMongoDatabaseName(rawUri, process.argv[2], "MongoDB") + "\n");
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

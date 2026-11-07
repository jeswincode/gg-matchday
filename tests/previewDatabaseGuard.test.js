import test from "node:test";
import assert from "node:assert/strict";
import { resolveV4PreviewDatabaseNames } from "../server/config/previewDatabaseGuard.js";

const base = {
  V4_PREVIEW_MODE: "true",
  MONGODB_URI: "mongodb+srv://core-user:secret@example.mongodb.net/gg_matchday_core?retryWrites=true",
  CLUBS_MONGODB_URI: "mongodb+srv://clubs-user:secret@example.mongodb.net/gg_matchday_clubs?retryWrites=true",
  V4_PREVIEW_CORE_DB_NAME: "gg_matchday_v4_preview_core",
  V4_PREVIEW_CLUBS_DB_NAME: "gg_matchday_v4_preview_clubs",
};

test("normal production mode does not override the configured database names", () => {
  assert.equal(resolveV4PreviewDatabaseNames({ ...base, V4_PREVIEW_MODE: "false" }), null);
  assert.equal(resolveV4PreviewDatabaseNames({ ...base, V4_PREVIEW_MODE: undefined }), null);
});

test("V4 preview selects two explicit staging databases", () => {
  assert.deepEqual(resolveV4PreviewDatabaseNames(base), {
    coreDbName: "gg_matchday_v4_preview_core",
    clubsDbName: "gg_matchday_v4_preview_clubs",
  });
});

test("V4 preview refuses to start when staging database names are not explicitly configured", () => {
  const { V4_PREVIEW_CORE_DB_NAME, V4_PREVIEW_CLUBS_DB_NAME, ...missing } = base;
  assert.throws(() => resolveV4PreviewDatabaseNames(missing), /V4_PREVIEW_CORE_DB_NAME and V4_PREVIEW_CLUBS_DB_NAME/);
});

test("V4 preview refuses either V3 database as a staging target", () => {
  assert.throws(() => resolveV4PreviewDatabaseNames({
    ...base,
    V4_PREVIEW_CORE_DB_NAME: "gg_matchday_core",
  }), /must not match either V3 Core or Clubs database/);
  assert.throws(() => resolveV4PreviewDatabaseNames({
    ...base,
    V4_PREVIEW_CLUBS_DB_NAME: "gg_matchday_clubs",
  }), /must not match either V3 Core or Clubs database/);
});

test("V4 preview refuses to share one database between Core and Clubs", () => {
  assert.throws(() => resolveV4PreviewDatabaseNames({
    ...base,
    V4_PREVIEW_CLUBS_DB_NAME: base.V4_PREVIEW_CORE_DB_NAME,
  }), /Core and Clubs staging databases must be separate/);
});

test("V4 preview requires explicit source database names to compare against", () => {
  assert.throws(() => resolveV4PreviewDatabaseNames({
    ...base,
    MONGODB_URI: "mongodb+srv://core-user:secret@example.mongodb.net/?retryWrites=true",
  }), /source database names must be explicit/);
});

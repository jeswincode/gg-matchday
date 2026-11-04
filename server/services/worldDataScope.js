import { AsyncLocalStorage } from "node:async_hooks";

const worldScope = new AsyncLocalStorage();

export function runWithWorldDataScope(worldId, callback) {
  return worldScope.run({ worldId: worldId || null }, callback);
}

export function currentWorldDataScope() {
  return worldScope.getStore() || null;
}

/**
 * Apply to World-owned Mongoose schemas, including schemas registered on the
 * separate Clubs connection. All reads and writes in a scoped HTTP request are
 * constrained to the resolved World. Requests without a selected World see
 * legacy documents only (worldId null/missing); background workers without an
 * AsyncLocalStorage request context must pass worldId explicitly.
 */
export function worldDataScopePlugin(schema) {
  const applyFilter = function applyWorldFilter() {
    const scope = currentWorldDataScope();
    if (!scope) return;

    const worldId = scope.worldId || null;
    this.where({ worldId });
  };

  schema.pre(/^find/, applyFilter);
  for (const operation of [
    "countDocuments",
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
    "replaceOne",
    "distinct",
  ]) {
    schema.pre(operation, applyFilter);
  }

  schema.pre("aggregate", function applyWorldAggregateFilter() {
    const scope = currentWorldDataScope();
    if (!scope) return;

    const pipeline = this.pipeline();
    const matchStage = { $match: { worldId: scope.worldId || null } };
    if (pipeline[0]?.$search || pipeline[0]?.$geoNear) pipeline.splice(1, 0, matchStage);
    else pipeline.unshift(matchStage);
  });

  schema.pre("validate", function assignWorldOnCreate() {
    const scope = currentWorldDataScope();
    if (!scope) return;

    const expected = scope.worldId || null;
    if (this.worldId != null && String(this.worldId) !== String(expected)) {
      this.invalidate("worldId", "A record cannot be created or moved outside the active World.");
      return;
    }
    this.worldId = expected;
  });

  for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
    schema.pre(operation, function enforceWorldOnUpdate() {
      const scope = currentWorldDataScope();
      if (!scope) return;
      const expected = scope.worldId || null;
      const update = this.getUpdate();
      if (!update) return;
      if (Array.isArray(update)) {
        this.setUpdate([...update, { $set: { worldId: expected } }]);
        return;
      }

      const next = { ...update };
      delete next.worldId;
      for (const operator of ["$set", "$setOnInsert", "$setOnUpdate"]) {
        if (next[operator]) {
          next[operator] = { ...next[operator], worldId: expected };
        }
      }
      if (!Object.keys(next).some(key => key.startsWith("$"))) {
        next.worldId = expected;
      } else {
        next.$setOnInsert = { ...(next.$setOnInsert || {}), worldId: expected };
        if (next.$set) delete next.$set.worldId;
      }
      this.setUpdate(next);
    });
  }
}

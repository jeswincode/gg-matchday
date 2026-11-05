import { AsyncLocalStorage } from "node:async_hooks";

const worldScope = new AsyncLocalStorage();

export function runWithWorldDataScope(worldId, callback, { includeLegacy = false } = {}) {
  const normalizedWorldId = worldId || null;
  return worldScope.run({
    worldId: normalizedWorldId,
    includeLegacy: Boolean(normalizedWorldId && includeLegacy),
  }, callback);
}

function isCurrentOrLegacyWorldSelector(value, worldId) {
  if (value === undefined || value === null || String(value) === String(worldId)) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.hasOwn(value, "$eq")) {
    return value.$eq == null || String(value.$eq) === String(worldId);
  }
  if (Array.isArray(value.$in)) {
    return value.$in.every(item => item == null || String(item) === String(worldId));
  }
  return false;
}

function legacyAwareWorldMatch(worldId) {
  return { $or: [{ worldId }, { worldId: null }] };
}

export function currentWorldDataScope() {
  return worldScope.getStore() || null;
}

/**
 * Apply to World-owned Mongoose schemas, including schemas registered on the
 * separate Clubs connection. All reads and writes in a scoped HTTP request are
 * constrained to the resolved World. The canonical one-World production
 * request can temporarily include legacy null/missing records until those
 * records are lazily assigned to Original GG by a normal write. Background
 * workers retain explicit per-World scopes.
 */
export function worldDataScopePlugin(schema) {
  const applyFilter = function applyWorldFilter() {
    const scope = currentWorldDataScope();
    if (!scope) return;

    const worldId = scope.worldId || null;
    if (scope.includeLegacy && worldId) {
      const filter = { ...this.getFilter() };
      if (isCurrentOrLegacyWorldSelector(filter.worldId, worldId)) delete filter.worldId;
      this.setQuery({
        $and: [
          filter,
          legacyAwareWorldMatch(worldId),
        ],
      });
      return;
    }
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
    const worldId = scope.worldId || null;
    const match = scope.includeLegacy && worldId
      ? legacyAwareWorldMatch(worldId)
      : { worldId };
    if (scope.includeLegacy && worldId) {
      for (const stage of pipeline) {
        if (stage?.$match && isCurrentOrLegacyWorldSelector(stage.$match.worldId, worldId)) {
          delete stage.$match.worldId;
        }
      }
    }
    const matchStage = { $match: match };
    if (pipeline[0]?.$search || pipeline[0]?.$searchMeta || pipeline[0]?.$geoNear || pipeline[0]?.$vectorSearch || pipeline[0]?.$documents) pipeline.splice(1, 0, matchStage);
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
      if (!Object.keys(next).some(key => key.startsWith("$"))) {
        delete next.worldId;
        next.worldId = expected;
      } else {
        for (const [operator, value] of Object.entries(next)) {
          if (!operator.startsWith("$") || !value || typeof value !== "object" || Array.isArray(value)) continue;
          const sanitized = { ...value };
          for (const key of Object.keys(sanitized)) {
            if (key === "worldId" || key.startsWith("worldId.")) delete sanitized[key];
            if (operator === "$rename" && (sanitized[key] === "worldId" || String(sanitized[key] || "").startsWith("worldId."))) {
              delete sanitized[key];
            }
          }
          next[operator] = sanitized;
        }
        next.$set = { ...(next.$set || {}), worldId: expected };
        if (next.$setOnInsert) delete next.$setOnInsert.worldId;
      }
      this.setUpdate(next);
    });
  }
}

import { requireAuth } from "./auth.js";
import { resolveWorldContext } from "./worldContext.js";
import { requireActiveWorldMembership } from "./worldPermissions.js";
import { runWithWorldDataScope } from "../services/worldDataScope.js";

/** Default-deny authorization boundary for private football-domain APIs. */
export function requirePrimaryWorldAccess(req, res, next) {
  return requireAuth(req, res, () =>
    resolveWorldContext(req, res, () =>
      requireActiveWorldMembership(req, res, () =>
        runWithWorldDataScope(req.worldId, next),
      ),
    ),
  );
}

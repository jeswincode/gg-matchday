import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  canEnterFounding, communitiesEnabled, communityStore, foundingCommunityId,
  synchronizeCommunityIdentity, verifiedCommunityIdentity,
} from "../services/communityPlatform.js";
import { AccessError, RequestConflict, isDuplicateKey } from "../../packages/data/community-store.ts";
import { InputError, parseProfilePatch, record, textField } from "../../packages/contracts/identity.ts";
import { defaultBrand } from "../../packages/branding/identity.ts";
import { parseMatch } from "../../packages/contracts/match.ts";
import { MatchService } from "../../packages/data/matches.ts";
import { updateWorkspaceProfile } from "../services/workspaceAccounts.js";
import { invalidateWorkspaceRecords } from "../services/workspaceRecords.js";

const router = express.Router();
const writes = new Map();

function allowWrite(uid) {
  const now = Date.now();
  const previous = writes.get(uid);
  if (previous?.expires > now) return ++previous.count <= 45;
  if (writes.size >= 2000) {
    for (const [key, item] of writes) if (item.expires <= now) writes.delete(key);
    if (writes.size >= 2000) return false;
  }
  writes.set(uid, { expires: now + 60_000, count: 1 });
  return true;
}

function requestKey(req) {
  const key = req.get("Idempotency-Key");
  if (!key || !/^[a-z0-9_-]{16,96}$/i.test(key)) throw new InputError("A stable request key is required.");
  return key;
}

function blueprint(req) {
  const id = req.params.id;
  if (!/^[a-f0-9]{64}$/.test(id)) throw new AccessError();
  return id;
}

function footballCommunity(req) {
  const id = blueprint(req);
  if (id === foundingCommunityId) throw new AccessError();
  return id;
}

async function requirePlayerId(req, res, next) {
  const profile = await communityStore().profile(req.communityAccount);
  if (!profile?.username) return res.status(409).json({ message: "Choose a player name and Player ID first." });
  next();
}

router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  if (!communitiesEnabled()) return res.sendStatus(404);
  next();
}, requireAuth, async (req, res, next) => {
  if (!verifiedCommunityIdentity(req)) return res.status(403).json({ message: "Verify your sign-in email before using Communities." });
  if (req.method !== "GET" && req.method !== "HEAD" && !allowWrite(req.firebaseUser.uid)) {
    return res.set("Retry-After", "60").status(429).json({ message: "Wait a minute before trying again." });
  }
  const platform = communityStore();
  const found = req.path === "/me" && req.method === "GET"
    ? await synchronizeCommunityIdentity(req)
    : { account: await platform.account(req.firebaseUser.uid, { displayName: req.user.name.slice(0, 80) }) };
  req.communityAccount = found.account;
  req.communityLinkNeedsReview = found.linkNeedsReview;
  next();
});

router.param("id", async (req, _res, next, id) => {
  if (id === foundingCommunityId && /\/(join-requests|invitation)(\/|$)/.test(req.path)) {
    if (req.user.role !== "admin" || !await canEnterFounding(req)) throw new AccessError();
    await communityStore().syncFounding(req.communityAccount, null, true);
  }
  next();
});

router.get("/me", async (req, res) => {
  const platform = communityStore();
  const account = req.communityAccount;
  const [profile, foundingAccess] = await Promise.all([platform.profile(account), canEnterFounding(req)]);
  res.json({
    profile, foundingAccess, foundingCommunityId,
    email: req.user.email, linkNeedsReview: Boolean(req.communityLinkNeedsReview),
  });
});

router.patch("/me", async (req, res) => {
  res.json(await updateWorkspaceProfile(req.communityAccount, parseProfilePatch(req.body), req));
});

router.get("/directory", async (req, res) => {
  const page = await communityStore().directory(req.communityAccount, textField(req.query.after ?? "", 0, 96));
  if (page.items.some(item => item.id === foundingCommunityId) && !await canEnterFounding(req)) {
    page.items = page.items.filter(item => item.id !== foundingCommunityId);
  }
  res.json(page);
});

router.post("/", requirePlayerId, async (req, res) => {
  const { name } = record(req.body);
  const brand = defaultBrand(name);
  if (brand.name.toLowerCase().replace(/\s+/g, " ") === "gg matchday") throw new InputError("Choose a different community name.");
  res.status(201).json(await communityStore().createCommunity(req.communityAccount, brand, requestKey(req)));
});

router.post("/:id/join", requirePlayerId, async (req, res) => {
  res.json(await communityStore().askToJoin(req.communityAccount, blueprint(req)));
});

router.get("/:id/join-requests", async (req, res) => {
  res.json(await communityStore().joinRequests(req.communityAccount, blueprint(req)));
});

router.patch("/:id/join-requests/:request", async (req, res) => {
  const { decision } = record(req.body);
  if (!["approve", "decline"].includes(decision)) throw new InputError("Choose approve or decline.");
  const id = blueprint(req);
  const result = await communityStore().decideJoinRequest(req.communityAccount, id, req.params.request, decision === "approve");
  invalidateWorkspaceRecords(id);
  res.json(result);
});

router.post("/:id/invitation", async (req, res) => {
  res.status(201).json(await communityStore().invite(req.communityAccount, blueprint(req)));
});

router.post("/:id/redeem", requirePlayerId, async (req, res) => {
  const token = textField(record(req.body).token, 43, 43);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InputError("Enter the full invitation code.");
  const id = blueprint(req);
  const result = await communityStore().redeem(req.communityAccount, id, token);
  invalidateWorkspaceRecords(id);
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = blueprint(req);
  if (id === foundingCommunityId && !await canEnterFounding(req)) throw new AccessError();
  res.json(await communityStore().openCommunity(req.communityAccount, id));
});

router.get("/:id/players", async (req, res) => {
  res.json(await communityStore().roster(req.communityAccount, footballCommunity(req), textField(req.query.after ?? "", 0, 96)));
});

router.post("/:id/guests", async (req, res) => {
  const name = textField(record(req.body).name, 1, 80);
  res.status(201).json(await communityStore().createGuest(req.communityAccount, footballCommunity(req), name, requestKey(req)));
});

router.get("/:id/matches", async (req, res) => {
  const matches = new MatchService(communityStore());
  res.json(await matches.list(req.communityAccount, footballCommunity(req), textField(req.query.after ?? "", 0, 100)));
});

router.post("/:id/matches", async (req, res) => {
  const matches = new MatchService(communityStore());
  const id = footballCommunity(req);
  const result = await matches.submit(req.communityAccount, id, parseMatch(req.body), requestKey(req));
  invalidateWorkspaceRecords(id);
  res.status(201).json(result);
});

router.patch("/:id/matches/:match", async (req, res) => {
  const { decision } = record(req.body);
  if (!["approve", "decline"].includes(decision)) throw new InputError("Choose approve or decline.");
  const matches = new MatchService(communityStore());
  const id = footballCommunity(req);
  const result = await matches.review(req.communityAccount, id, req.params.match, decision === "approve");
  invalidateWorkspaceRecords(id);
  res.json(result);
});

router.get("/:id/calendar", async (req, res) => {
  const id = footballCommunity(req);
  const month = textField(req.query.month, 7, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new InputError("Choose a valid month.");
  res.json(await communityStore().within(req.communityAccount, id, null, async (db, session) =>
    db.collection("matches").find({
      communityId: id, status: "official", date: { $gte: month + "-01", $lte: month + "-31" },
    }, { session, projection: { date: 1, home: 1, away: 1, homeScore: 1, awayScore: 1 } })
      .sort({ date: 1, _id: 1 }).limit(200).toArray()));
});

router.get("/:id/standings", async (req, res) => {
  const id = footballCommunity(req);
  res.json(await communityStore().within(req.communityAccount, id, null, async (db, session) =>
    db.collection("matches").aggregate([
      { $match: { communityId: id, status: "official", performances: { $type: "array" } } },
      { $unwind: "$performances" },
      { $group: {
        _id: "$performances.playerId", appearances: { $sum: 1 }, goals: { $sum: "$performances.goals" },
        assists: { $sum: "$performances.assists" },
        knownAssists: { $sum: { $cond: [{ $isNumber: "$performances.assists" }, 1, 0] } },
      } },
      { $sort: { goals: -1, assists: -1, appearances: -1, _id: 1 } },
      { $limit: 100 },
    ], { session }).toArray()));
});

router.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof InputError) return res.status(400).json({ message: error.message });
  if (error instanceof AccessError) return res.status(404).json({ message: "This community, invitation or record is unavailable." });
  if (isDuplicateKey(error) && error.keyPattern?.username) {
    return res.status(409).json({ message: "That Player ID is already taken. Choose another one." });
  }
  if (isDuplicateKey(error) && error.keyPattern?.name) {
    return res.status(409).json({ message: "That player name is already in your GG Matchday roster." });
  }
  if (error instanceof RequestConflict || isDuplicateKey(error)) {
    return res.status(409).json({ message: "The request conflicts with an existing record. Refresh and check the details." });
  }
  next(error);
});

export default router;

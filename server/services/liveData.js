import mongoose from "mongoose";
import { getClubsConnection } from "../config/clubsDatabase.js";
import { workspaceId } from "../config/workspaceModels.js";

// Only a topic is sent to the browser. Documents and identifiers stay behind
// the normal API authorization checks.
const publicTopics = new Set(["matchday", "news", "clubs"]);
const coreModels = {
  Match: "matchday",
  Player: "matchday",
  PlayerStats: "matchday",
  SeasonStats: "matchday",
  Award: "matchday",
  Achievement: "matchday",
  News: "news",
  Notification: "notifications",
  ChatMessage: "chat",
};
const clubsModels = {
  Club: "clubs",
  ClubMatch: "clubs",
  ClubPlayerStats: "clubs",
  ClubContract: "club-account",
  ClubFormationApplication: "club-account",
  ClubHistory: "club-account",
  ClubRenewalDecision: "club-account",
  ClubCreditBet: "club-account",
  ClubMatchBet: "club-account",
  ClubWalletTransaction: "club-account",
  PlayerWallet: "club-account",
  PlayerWalletTransaction: "club-account",
  JoinRequest: "club-account",
  AuctionOffer: "club-account",
  PlayerReview: "club-account",
  ClubAdminAuditEvent: "club-account",
  ClubSyncJob: "club-account",
};
const readers = [
  { connection: () => mongoose.connection, models: coreModels },
  { connection: getClubsConnection, models: clubsModels },
];
const clients = new Map();
const queued = new Map();
let flushTimer;

function queueTopics(topics, scope = null) {
  if (!clients.size) return;
  if (!queued.has(scope)) queued.set(scope, new Set());
  for (const topic of topics) queued.get(scope).add(topic);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    for (const [response, client] of clients) {
      const topics = queued.get(client.scope) || [];
      const allowed = [...topics].filter(topic => client.userId ? !publicTopics.has(topic) : publicTopics.has(topic));
      if (allowed.length && !response.destroyed && !response.writableEnded &&
          !response.write(`event: data-updated\ndata: ${JSON.stringify(allowed)}\n\n`)) {
        response.end();
      }
    }
    queued.clear();
  }, 250);
  flushTimer.unref();
}

function reconcile(topics) {
  for (const scope of new Set(Array.from(clients.values(), client => client.scope))) queueTopics(topics, scope);
}

async function consume(reader) {
  if (!clients.size || reader.running) return;
  reader.running = true;
  const connection = reader.connection();
  const topics = Object.values(reader.models);
  try {
    if (connection.readyState !== 1) throw new Error("Database connection unavailable");
    const topicsByCollection = Object.fromEntries(Object.entries(reader.models).map(([name, topic]) =>
      [connection.models[name].collection.name, topic],
    ));
    reader.stream = connection.db.watch([
      { $match: {
        "ns.coll": { $in: [...Object.keys(topicsByCollection), /^community_[a-f0-9]{64}_/] },
        operationType: { $in: ["insert", "update", "replace", "delete"] },
      } },
      { $project: { _id: 1, "ns.coll": 1 } },
    ], { maxAwaitTimeMS: 1_000 });
    const stream = reader.stream;
    let firstBatch = true;
    while (clients.size && reader.stream === stream && !stream.closed) {
      const change = await stream.tryNext();
      const collection = change?.ns?.coll || "";
      const [, scope, localCollection] = /^community_([a-f0-9]{64})_(.+)$/.exec(collection) || [];
      const topic = topicsByCollection[localCollection || collection];
      if (topic && (!scope || [...clients.values()].some(client => client.scope === scope))) queueTopics([topic], scope || null);
      // Reconcile writes that happened while the watcher was unavailable.
      if (firstBatch && reader.recovering) reconcile(topics);
      firstBatch = false;
      reader.recovering = false;
    }
  } catch (error) {
    if (clients.size && !reader.recovering) {
      console.warn("Live updates watcher unavailable", { code: error.code ?? "connection" });
    }
    reader.recovering = Boolean(clients.size);
  } finally {
    await reader.stream?.close().catch(() => {});
    reader.stream = undefined;
    reader.running = false;
    if (clients.size) {
      // A standalone MongoDB or a temporary watcher failure can still
      // revalidate active screens at a bounded interval.
      reader.retry = setTimeout(() => {
        reconcile(topics);
        void consume(reader);
      }, 20_000);
      reader.retry.unref();
    }
  }
}

export function attachLiveData(response, userId = null) {
  const wasIdle = clients.size === 0;
  clients.set(response, { userId, scope: workspaceId() });
  if (wasIdle) {
    for (const reader of readers) {
      void consume(reader);
    }
  }
  response.once("close", () => {
    clients.delete(response);
    if (clients.size) return;
    clearTimeout(flushTimer);
    flushTimer = undefined;
    queued.clear();
    for (const reader of readers) {
      clearTimeout(reader.retry);
      void reader.stream?.close().catch(() => {});
    }
  });
}

export function closeLiveData() {
  for (const response of clients.keys()) response.end();
}

export function streamPrivateUpdates(req, res) {
  const userId = String(req.user._id);
  if (clients.size >= 500 || [...clients.values()].filter(client => client.userId === userId).length >= 5) {
    return res.status(429).json({ message: "Too many live connections." });
  }
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("event: ready\ndata: {}\n\n");
  attachLiveData(res, userId);
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded && !res.write(": keep-alive\n\n")) res.end();
  }, 15_000);
  const renewal = setTimeout(() => res.end(), 45 * 60_000);
  heartbeat.unref();
  renewal.unref();
  res.once("close", () => {
    clearInterval(heartbeat);
    clearTimeout(renewal);
  });
}

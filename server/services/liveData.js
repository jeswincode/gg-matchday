import mongoose from "mongoose";
import { getClubsConnection } from "../config/clubsDatabase.js";

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
const queued = new Set();
let flushTimer;

function queueTopics(topics) {
  if (!clients.size) return;
  for (const topic of topics) queued.add(topic);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    const topics = [...queued];
    queued.clear();
    for (const [response, userId] of clients) {
      const allowed = topics.filter(topic => userId ? !publicTopics.has(topic) : publicTopics.has(topic));
      if (allowed.length && !response.destroyed && !response.writableEnded &&
          !response.write(`event: data-updated\ndata: ${JSON.stringify(allowed)}\n\n`)) {
        response.end();
      }
    }
  }, 250);
  flushTimer.unref();
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
        "ns.coll": { $in: Object.keys(topicsByCollection) },
        operationType: { $in: ["insert", "update", "replace", "delete"] },
      } },
      { $project: { _id: 1, "ns.coll": 1 } },
    ], { maxAwaitTimeMS: 1_000 });
    const stream = reader.stream;
    let firstBatch = true;
    while (clients.size && reader.stream === stream && !stream.closed) {
      const change = await stream.tryNext();
      const topic = topicsByCollection[change?.ns?.coll];
      if (topic) queueTopics([topic]);
      // Reconcile writes that happened while the watcher was unavailable.
      if (firstBatch && reader.recovering) queueTopics(topics);
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
        queueTopics(topics);
        void consume(reader);
      }, 20_000);
      reader.retry.unref();
    }
  }
}

export function attachLiveData(response, userId = null) {
  const wasIdle = clients.size === 0;
  clients.set(response, userId);
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
  if (clients.size >= 500 || [...clients.values()].filter(id => id === userId).length >= 5) {
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

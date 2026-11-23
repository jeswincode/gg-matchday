import test from "node:test";
import assert from "node:assert/strict";
import { createAccountSync } from "../src/lib/accountSync.js";

test("a replaced account request cannot restore an old identity or permissions", async () => {
  const calls = [];
  const pending = new Map();
  const session = createAccountSync({
    load: (user, signal) => new Promise(resolve => pending.set(user.uid, { signal, resolve })),
    onIdentity: user => calls.push(["identity", user?.uid ?? null]),
    onResult: user => calls.push(["result", user]),
    onError: error => calls.push(["error", error]),
    onSettled: () => calls.push(["settled"]),
  });
  const old = session.sync({ uid: "old" });
  await session.sync({ uid: "old" });
  const current = session.sync({ uid: "current" });
  assert.equal(pending.get("old").signal.aborted, true);
  pending.get("old").resolve("old admin");
  pending.get("current").resolve("current viewer");
  await Promise.all([old, current]);
  await session.sync(null);
  assert.deepEqual(calls, [
    ["identity", "old"], ["identity", "current"], ["result", "current viewer"], ["settled"], ["identity", null],
  ]);
});

test("account setup settles even when its token or network request never resolves", async () => {
  const calls = [];
  const session = createAccountSync({
    timeout: 5,
    retryDelays: [],
    load: () => new Promise(() => {}),
    onIdentity: () => {},
    onResult: () => assert.fail("The request never returned"),
    onError: error => calls.push(error.message),
    onSettled: () => calls.push("settled"),
  });
  await session.sync({ uid: "returning" });
  assert.deepEqual(calls, ["Checking your Matchday account timed out.", "settled"]);
});

test("a cold server can outlast the first account attempt and still restore permissions", async () => {
  const calls = [];
  let count = 0;
  const session = createAccountSync({
    timeout: 5,
    retryDelays: [0, 0],
    load() {
      count++;
      if (count === 1) return new Promise(() => {});
      if (count === 2) throw Object.assign(new Error("Waking up"), { retryable: true });
      return { id: "account", role: "admin" };
    },
    onIdentity: user => calls.push(user.uid),
    onResult: (user, info) => calls.push([user.role, info.recovered]),
    onError: () => assert.fail("Temporary failures must not replace the signed-in role"),
    onSettled: () => calls.push("settled"),
  });
  await session.sync({ uid: "returning" });
  assert.equal(count, 3);
  assert.deepEqual(calls, ["returning", ["admin", true], "settled"]);
});

test("failed sync can be restarted once without replaying permanent errors on focus", async () => {
  const calls = [];
  const session = createAccountSync({
    load() {
      if (!calls.length) throw Object.assign(new Error("Rejected"), { retryable: false });
      return { id: "account", role: "editor" };
    },
    onIdentity: () => {},
    onResult: (user, info) => calls.push([user.role, info.recovered]),
    onError: error => calls.push(error.message),
    onSettled: () => calls.push("settled"),
  });
  await session.sync({ uid: "returning" });
  await session.retry({ automatic: true });
  assert.deepEqual(calls, ["Rejected", "settled"]);
  await Promise.all([session.retry(), session.retry()]);
  assert.deepEqual(calls, ["Rejected", "settled", ["editor", true], "settled"]);
});

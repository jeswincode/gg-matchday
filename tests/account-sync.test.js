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
    load: () => new Promise(() => {}),
    onIdentity: () => {},
    onResult: () => assert.fail("The request never returned"),
    onError: error => calls.push(error.message),
    onSettled: () => calls.push("settled"),
  });
  await session.sync({ uid: "returning" });
  assert.deepEqual(calls, ["Checking your Matchday account timed out.", "settled"]);
});

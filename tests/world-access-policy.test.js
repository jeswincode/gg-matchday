import test from "node:test";
import assert from "node:assert/strict";
import { hasOriginalGGWorldAccess, isVerifiedGmailAddress, normalizeWorldEmail } from "../server/services/worldAccessPolicy.js";

test("only explicitly verified @gmail.com identities satisfy the Gmail rule", () => {
  assert.equal(isVerifiedGmailAddress("player@gmail.com", true), true);
  assert.equal(isVerifiedGmailAddress("PLAYER+gg@gmail.com", true), true);
  assert.equal(isVerifiedGmailAddress("player@gmail.com", false), false);
  assert.equal(isVerifiedGmailAddress("player@googlemail.com", true), false);
  assert.equal(isVerifiedGmailAddress("player@example.com", true), false);
  assert.equal(isVerifiedGmailAddress("player@gmail.com.example", true), false);
});
test("email normalization is stable", () => {
  assert.equal(normalizeWorldEmail(" Player@GMAIL.com "), "player@gmail.com");
});
test("Original GG requires matching verified Gmail token and an admin-linked player", () => {
  const valid = { tokenEmail:"player@gmail.com", accountEmail:"player@gmail.com", emailVerified:true, playerProfile:"65a000000000000000000001" };
  assert.equal(hasOriginalGGWorldAccess(valid), true);
  assert.equal(hasOriginalGGWorldAccess({ ...valid, emailVerified:false }), false);
  assert.equal(hasOriginalGGWorldAccess({ ...valid, tokenEmail:"player@example.com" }), false);
  assert.equal(hasOriginalGGWorldAccess({ ...valid, accountEmail:"other@gmail.com" }), false);
  assert.equal(hasOriginalGGWorldAccess({ ...valid, playerProfile:null }), false);
});
test("E2E linked identities bypass Gmail only outside production", () => {
  assert.equal(hasOriginalGGWorldAccess({ playerProfile:"65a000000000000000000001", testOnly:true, environment:"test" }), true);
  assert.equal(hasOriginalGGWorldAccess({ playerProfile:"65a000000000000000000001", testOnly:true, environment:"production" }), false);
});

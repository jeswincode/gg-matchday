export function normalizeWorldEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isVerifiedGmailAddress(value, emailVerified) {
  return emailVerified === true && /^[^\s@]+@gmail\.com$/.test(normalizeWorldEmail(value));
}

export function hasOriginalGGWorldAccess({ tokenEmail, accountEmail, emailVerified, playerProfile, testOnly = false, environment = process.env.NODE_ENV } = {}) {
  if (testOnly) return environment !== "production" && Boolean(playerProfile);
  const token = normalizeWorldEmail(tokenEmail);
  const account = normalizeWorldEmail(accountEmail);
  return isVerifiedGmailAddress(token, emailVerified) && token === account && Boolean(playerProfile);
}

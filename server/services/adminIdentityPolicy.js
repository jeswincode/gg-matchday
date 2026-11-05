export function isVerifiedConfiguredAdminEmail(email, emailVerified, configuredAdminEmail) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedConfiguredEmail = String(configuredAdminEmail || "").trim().toLowerCase();
  return Boolean(
    normalizedEmail &&
    normalizedConfiguredEmail &&
    emailVerified === true &&
    normalizedEmail === normalizedConfiguredEmail
  );
}

export function hasAdminRoleAuthority({
  role,
  emailVerified,
  testOnly = false,
  environment = process.env.NODE_ENV,
} = {}) {
  if (role !== "admin") return false;
  if (testOnly) return environment !== "production";
  return emailVerified === true;
}

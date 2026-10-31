let activeWorldSlug = null;

export function normalizeWorldSlug(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidWorldSlug(value) {
  const slug = normalizeWorldSlug(value);
  return slug.length >= 3 &&
    slug.length <= 48 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Set the current World selector for subsequent API calls.
 * Passing null or an empty string clears World context.
 * This value is a request selector only; the backend still verifies membership.
 */
export function setActiveWorldSlug(value) {
  const normalized = normalizeWorldSlug(value);
  if (!normalized) {
    activeWorldSlug = null;
    return null;
  }
  if (!isValidWorldSlug(normalized)) {
    throw new TypeError("A valid World slug is required.");
  }
  activeWorldSlug = normalized;
  return activeWorldSlug;
}

export function getActiveWorldSlug() {
  return activeWorldSlug;
}

export function worldContextHeaders(worldSlug = activeWorldSlug) {
  const normalized = normalizeWorldSlug(worldSlug);
  if (!normalized || !isValidWorldSlug(normalized)) return {};
  return { "X-World-Slug": normalized };
}

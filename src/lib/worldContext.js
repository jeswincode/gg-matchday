let activeWorldSlug = null;

const WORLD_CONTEXT_STORAGE_KEY = "gg.activeWorldSlug";

export function normalizeWorldSlug(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidWorldSlug(value) {
  const slug = normalizeWorldSlug(value);
  return slug.length >= 3 &&
    slug.length <= 48 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function storedWorldSlug() {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const stored = normalizeWorldSlug(window.sessionStorage.getItem(WORLD_CONTEXT_STORAGE_KEY));
    return isValidWorldSlug(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistWorldSlug(slug) {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    if (slug) window.sessionStorage.setItem(WORLD_CONTEXT_STORAGE_KEY, slug);
    else window.sessionStorage.removeItem(WORLD_CONTEXT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private/restricted browsing contexts.
    // The in-memory selector still protects requests for the current page.
  }
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
    persistWorldSlug(null);
    return null;
  }
  if (!isValidWorldSlug(normalized)) {
    throw new TypeError("A valid World slug is required.");
  }
  activeWorldSlug = normalized;
  persistWorldSlug(activeWorldSlug);
  return activeWorldSlug;
}

export function getActiveWorldSlug() {
  if (activeWorldSlug && isValidWorldSlug(activeWorldSlug)) return activeWorldSlug;
  activeWorldSlug = storedWorldSlug();
  return activeWorldSlug;
}

export function worldContextHeaders(worldSlug) {
  const selected = worldSlug === undefined ? getActiveWorldSlug() : worldSlug;
  const normalized = normalizeWorldSlug(selected);
  if (!normalized || !isValidWorldSlug(normalized)) return {};
  return { "X-World-Slug": normalized };
}

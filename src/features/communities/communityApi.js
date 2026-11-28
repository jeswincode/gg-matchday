import { api } from "../../lib/api";

export const communityRequest = (path, options) => api("/communities" + path, options);

export async function communityPages(path, signal) {
  const items = [];
  let cursor;
  do {
    const page = await communityRequest(path + (cursor ? "?after=" + encodeURIComponent(cursor) : ""), { signal });
    items.push(...page.items);
    cursor = page.next;
  } while (cursor);
  return items;
}

export function submitCommunity(path, body, key, method = "POST") {
  return communityRequest(path, { method, body, ...(key && { headers: { "Idempotency-Key": key } }) });
}

export const validCommunityCode = value => /^[a-f0-9]{64}$/.test(value);

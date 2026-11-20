export const clubTimeZone = "Asia/Kolkata";
const fixtureFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: clubTimeZone,
});
const dateParts = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: clubTimeZone,
});
const creditFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function clubDateKey(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(dateParts.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function fixtureDateLabel(fixture) {
  const date = fixture?.fixtureDate
    ? new Date(fixture.fixtureDate + "T12:00:00+05:30")
    : new Date(fixture?.scheduledAt || fixture?.placedAt || NaN);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : fixtureFormat.format(date);
}

export function credits(value) {
  return creditFormat.format(Number(value) || 0);
}

export function clubInitials(name) {
  return String(name || "Club").trim().split(/\s+/).slice(0, 3).map(word => word[0]).join("").toUpperCase();
}

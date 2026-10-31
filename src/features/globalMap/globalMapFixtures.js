/**
 * Public-only sample data for the Global Map renderer prototype.
 * Membership state is deliberately kept separate from the public World projection.
 */
export const GLOBAL_MAP_DEMO_WORLDS = [
  { slug: "original-gg", name: "Original GG", emblem: "GG", description: "The founding football community.", memberCount: 24, globalMap: { x: 4, y: 4 } },
  { slug: "college-league", name: "College League", emblem: "CL", description: "College football and campus rivalries.", memberCount: 18, globalMap: { x: 10, y: 3 } },
  { slug: "weekend-arena", name: "Weekend Arena", emblem: "WA", description: "A community for weekend football.", memberCount: 32, globalMap: { x: 15, y: 7 } },
  { slug: "northside-football", name: "Northside FC", emblem: "NF", description: "Local teams, training and competition.", memberCount: 12, globalMap: { x: 6, y: 11 } }
];

export const GLOBAL_MAP_DEMO_MEMBERSHIP = {
  "original-gg": "active",
  "college-league": "none",
  "weekend-arena": "pending",
  "northside-football": "none",
};

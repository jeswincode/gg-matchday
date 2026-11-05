import { AVATAR_OPTIONS } from "../../shared/worldCustomization.js";
export const WORLD_MAP_SLUG = "original-gg";

export const DEFAULT_WORLD_LAYOUT = Object.freeze({
  version: 7,
  orientation: "isometric",
  tileWidth: 128,
  tileHeight: 64,
  renderOrder: "right-down",
  layers: [
    { id: "terrain", type: "tile", order: 0 },
    { id: "roads", type: "path", order: 1 },
    { id: "landscaping", type: "decoration", order: 2 },
    { id: "buildings", type: "object", order: 3 },
    { id: "interactive-zones", type: "object", order: 4 },
    { id: "characters", type: "entity", order: 5 },
  ],
  width: 1800,
  height: 1200,
  districts: [
    { id: "crown-quarter", label: "Crown Quarter", x: 900, y: 310, tone: "gold" },
    { id: "stadium-quarter", label: "Stadium Quarter", x: 470, y: 590, tone: "grass" },
    { id: "training-quarter", label: "Training Grounds", x: 1320, y: 560, tone: "grass" },
    { id: "club-quarter", label: "Club District", x: 390, y: 930, tone: "stone" },
    { id: "residential-quarter", label: "Residence Gardens", x: 1120, y: 930, tone: "garden" },
    { id: "transit-quarter", label: "Matchday Station", x: 1580, y: 560, tone: "stone" },
    { id: "supporters-quarter", label: "Supporters Quarter", x: 690, y: 360, tone: "gold" },
    { id: "community-quarter", label: "Community Fields", x: 820, y: 1060, tone: "grass" },
  ],
  locations: [
    { id: "city-plaza", name: "City Plaza", kind: "plaza", x: 900, y: 600, width: 150, height: 110, description: "The central meeting square, with a fountain, club banners and a matchday notice board.", interior: { rooms: [
      { id: "community-square", name: "Community Square", description: "The heart of the city, where players meet before heading to their next destination.", theme: "stone-gold", items: ["central-fountain", "club-banners", "matchday-board", "city-clock"] },
      { id: "supporters-corner", name: "Supporters' Corner", description: "A small gathering spot for club supporters and football conversations.", theme: "green", items: ["supporter-flags", "bench-row", "football-mural"] },
    ] } },
    { id: "gg-hq", name: "GG Headquarters", kind: "headquarters", x: 900, y: 310, width: 250, height: 190, access: "public", description: "The golden heart of Original GG. Meet the community, explore the trophy hall and see what the city is building next.", interior: { rooms: [{ id: "grand-hall", name: "Grand Hall", description: "The central meeting place of the GG community, with a live city board and player gathering space.", theme: "marble-gold", items: ["golden-doors","community-board","city-map","club-banners"] }, { id: "trophy-gallery", name: "Trophy Gallery", description: "A hall for club achievements, personal records and legendary Matchday moments.", theme: "gold", items: ["trophy-cabinet","medal-wall","hall-of-fame","match-balls"] }, { id: "club-lounge", name: "Club Lounge", description: "A social room for players to meet, show their colours and celebrate their clubs.", theme: "clubhouse", items: ["sofas","club-flags","chat-wall","notice-board"] }, { id: "meeting-room", name: "Meeting Room", description: "A quieter space for club planning and community meetings.", theme: "dark-wood", items: ["meeting-table","tactics-board","wall-screen"] }] } },
    { id: "grand-stadium", name: "The Grand Stadium", kind: "stadium", x: 470, y: 590, width: 360, height: 250, access: "public", description: "The home of matchday nights, club showcases and unforgettable football moments.", interior: { rooms: [{ id: "player-tunnel", name: "Player Tunnel", description: "Walk out from the changing rooms into the roar of the stadium.", theme: "concrete", items: ["team-lockers","tunnel-lights","matchday-sign"] }, { id: "main-stands", name: "Main Stands", description: "A packed stand overlooking the pitch, with club colours across the terraces.", theme: "stadium", items: ["seats","supporter-flags","scoreboard"] }, { id: "press-box", name: "Press Box", description: "A high view over the ground for match reports and memorable moments.", theme: "broadcast", items: ["commentary-desk","camera-rig","match-screen"] }] } },
    { id: "training-centre", name: "Training Centre", kind: "training", x: 1320, y: 560, width: 300, height: 220, access: "public", description: "Build your routine, log your workout counters and chase new personal bests.", interior: { rooms: [{ id: "strength-gym", name: "Strength Gym", description: "Your workout station for push-ups, pull-ups, squats and personal records.", theme: "training", items: ["pushup-mats","pullup-bars","squat-racks","record-board"] }, { id: "indoor-pitch", name: "Indoor Pitch", description: "A small-sided training space for future ball-control and skill challenges.", theme: "pitch", items: ["mini-pitch","training-cones","football-rack","goal-nets"] }, { id: "recovery-room", name: "Recovery Room", description: "A calm corner to review your sessions and plan your next training target.", theme: "recovery", items: ["recovery-benches","water-station","training-calendar"] }] } },
    { id: "club-district", name: "Club District", kind: "club-district", x: 390, y: 930, width: 340, height: 190, access: "public", description: "A neighbourhood of club grounds. Each approved GG club can grow its own football home here." },
    { id: "residence-gardens", name: "Residence Gardens", kind: "residences", x: 1120, y: 930, width: 330, height: 190, access: "public-exterior", description: "A home district for GG players. Public streets lead to private interiors with owner-controlled visits." },
    { id: "academy-square", name: "Football Academy", kind: "academy", x: 850, y: 760, width: 230, height: 160, access: "public", description: "A place for skill challenges, guided tours and future football lessons.", interior: { rooms: [{ id: "tactics-class", name: "Tactics Classroom", description: "Learn the game through formations, match scenarios and football challenges.", theme: "academy", items: ["tactics-board","formation-wall","video-screen"] }, { id: "skills-lab", name: "Skills Lab", description: "A place for future skill drills, ball mastery and player development.", theme: "pitch", items: ["ball-rack","cones","agility-ladders"] }] } },
    { id: "market-square", name: "Market Square", kind: "market", x: 1510, y: 850, width: 220, height: 150, access: "public", description: "Browse earned cosmetics, customise your footballer and upgrade your home in the GG Market.", interior: { rooms: [{ id: "gg-market", name: "GG Market", description: "Spend earned GG Coins on character cosmetics and player-home upgrades.", theme: "market", items: ["kit-display","boot-wall","cosmetic-counter"] }] } },
    { id: "garden-park", name: "Garden Park", kind: "park", x: 1450, y: 290, width: 250, height: 180, access: "public", description: "A green pocket of the city with paths, benches and room for your character to hang out.", interior: { rooms: [{ id: "garden-green", name: "Garden Green", description: "A quiet park space for players to hang out and meet friends.", theme: "garden", items: ["benches","fountain","trees","community-notice"] }] } },
    { id: "gg-football-museum", name: "GG Football Museum", kind: "museum", x: 570, y: 820, width: 230, height: 170, access: "public", description: "Celebrate the history, clubs, great matches and legends of GG Matchday.", interior: { rooms: [{ id: "heritage-gallery", name: "Heritage Gallery", description: "A walk through the moments that built the GG football community.", theme: "gold", items: ["history-wall","classic-shirts","matchday-photos","club-crests"] }, { id: "hall-of-legends", name: "Hall of Legends", description: "A place for records, milestones and achievements earned by the community.", theme: "marble-gold", items: ["legend-portraits","record-book","medal-cases"] }] } },
    { id: "matchday-station", name: "Matchday Station", kind: "transit", x: 1580, y: 560, width: 210, height: 160, access: "public", description: "The city's arrival point for supporters travelling in for a big matchday.", interior: { rooms: [{ id: "station-concourse", name: "Station Concourse", description: "Meet friends, check the fixture board and make your way to the stadium.", theme: "stone-gold", items: ["fixture-board","ticket-gates","station-clock","supporter-meetup"] }, { id: "supporters-hall", name: "Supporters Hall", description: "A warm indoor gathering space before the walk down Fan Boulevard.", theme: "clubhouse", items: ["club-flags","matchday-cafe","fan-notice-board"] }] } },
    { id: "fan-boulevard", name: "Fan Boulevard", kind: "fan-zone", x: 690, y: 360, width: 260, height: 130, access: "public", description: "A colourful supporters street for club flags, matchday gatherings and community events.", interior: { rooms: [{ id: "supporters-street", name: "Supporters Street", description: "A public gathering space with club banners, murals and a matchday stage.", theme: "clubhouse", items: ["club-banner-wall","supporters-stage","fan-mural","matchday-lights"] }] } },
    { id: "gg-esports-arena", name: "GG Esports Arena", kind: "esports", x: 1540, y: 300, width: 230, height: 170, access: "public", description: "A future home for digital football tournaments, skill challenges and community leaderboards.", interior: { rooms: [{ id: "arena-floor", name: "Arena Floor", description: "A tournament stage with player booths, screens and a live event board.", theme: "neon", items: ["tournament-stage","player-booths","live-scoreboard","event-screen"] }] } },
    { id: "community-pitches", name: "Community Pitches", kind: "community-pitch", x: 820, y: 1060, width: 250, height: 150, access: "public", description: "Small-sided pitches for casual football, future skill games and friendly community events.", interior: { rooms: [{ id: "five-a-side", name: "Five-a-Side Pitch", description: "A compact football space for future team challenges and casual matches.", theme: "pitch", items: ["five-a-side-pitch","mini-goals","ball-rack","substitutes-bench"] }] } },
  ],
  plots: [
    { id: "residence-plot-01", name: "Residence Plot 01", districtId: "residence-gardens", x: 1110, y: 1030, category: "residential", status: "planned", description: "A future home site in the Residence Gardens." },
    { id: "residence-plot-02", name: "Residence Plot 02", districtId: "residence-gardens", x: 1390, y: 1080, category: "residential", status: "planned", description: "A future home site in the Residence Gardens." },
    { id: "club-plot-01", name: "Club Plot 01", districtId: "club-district", x: 760, y: 1000, category: "club", status: "planned", description: "Reserved space for future club-city expansion." },
    { id: "academy-plot-01", name: "Academy Plot 01", districtId: "academy-square", x: 700, y: 820, category: "community", status: "planned", description: "A future player-development and academy site." },
    { id: "stadium-plot-01", name: "Stadium Plot 01", districtId: "stadium-quarter", x: 230, y: 810, category: "commercial", status: "planned", description: "A future matchday service site near the stadium." },
    { id: "market-plot-01", name: "Market Plot 01", districtId: "market-square", x: 1510, y: 970, category: "commercial", status: "planned", description: "A future shop and community-service site." },
  ],
});

const AVATAR_OPTION_SETS = Object.fromEntries(Object.entries(AVATAR_OPTIONS).map(([key, values]) => [key, new Set(values)]));

function enumValue(value, allowed, fallback) {
  const candidate = String(value || "").trim().toLowerCase();
  return allowed.has(candidate) ? candidate : fallback;
}

export function normalizeAvatarPayload(input = {}) {
  input = input && typeof input === "object" ? input : {};
  const displayName = String(input.displayName || "").trim().replace(/\s+/g, " ");
  if (displayName.length > 24) throw new TypeError("Character name must be 24 characters or fewer.");
  return {
    displayName,
    appearance: {
      skinTone: enumValue(input.appearance?.skinTone, AVATAR_OPTION_SETS.skinTone, "medium"),
      bodyType: enumValue(input.appearance?.bodyType, AVATAR_OPTION_SETS.bodyType, "athletic"),
      hairStyle: enumValue(input.appearance?.hairStyle, AVATAR_OPTION_SETS.hairStyle, "short"),
      hairColor: enumValue(input.appearance?.hairColor, AVATAR_OPTION_SETS.hairColor, "black"),
      kitPrimary: enumValue(input.appearance?.kitPrimary, AVATAR_OPTION_SETS.kitPrimary, "black"),
      kitSecondary: enumValue(input.appearance?.kitSecondary, AVATAR_OPTION_SETS.kitSecondary, "gold"),
      bootColor: enumValue(input.appearance?.bootColor, AVATAR_OPTION_SETS.bootColor, "white"),
      headAccessory: enumValue(input.appearance?.headAccessory, AVATAR_OPTION_SETS.headAccessory, "none"),
    },
    tutorialComplete: input.tutorialComplete === true,
  };
}

const EXERCISES = ["pushups", "pullups", "squats", "planks"];

export function normalizeTrainingSession(input = {}) {
  input = input && typeof input === "object" ? input : {};
  const sessionId = String(input.sessionId || "").trim();
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(sessionId)) {
    throw new TypeError("A valid workout session ID is required.");
  }

  const rawCounts = input.counts && typeof input.counts === "object" ? input.counts : {};
  const counts = Object.fromEntries(EXERCISES.map((key) => {
    const value = Number(rawCounts[key] ?? 0);
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
      throw new TypeError("Workout counters must be whole numbers between 0 and 1,000.");
    }
    return [key, value];
  }));
  const totalCounts = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (totalCounts < 1 || totalCounts > 1500) {
    throw new TypeError("A workout must contain between 1 and 1,500 recorded reps.");
  }

  const durationSeconds = Number(input.durationSeconds);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 28800) {
    throw new TypeError("Workout duration must be between 1 second and 8 hours.");
  }

  return { sessionId, counts, totalCounts, durationSeconds };
}

export function normalizePresencePayload(input = {}) {
  input = input && typeof input === "object" ? input : {};
  const locationId = String(input.locationId || "city-plaza").trim().slice(0, 64);
  const x = Number(input.x);
  const y = Number(input.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > DEFAULT_WORLD_LAYOUT.width || y < 0 || y > DEFAULT_WORLD_LAYOUT.height) {
    throw new TypeError("Character position is outside the Original GG world.");
  }
  return { locationId, x: Math.round(x), y: Math.round(y) };
}

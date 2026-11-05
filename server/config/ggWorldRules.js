export const WORLD_MAP_SLUG = "original-gg";

export const DEFAULT_WORLD_LAYOUT = Object.freeze({
  version: 1,
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
  ],
  locations: [
    { id: "gg-hq", name: "GG Headquarters", kind: "headquarters", x: 900, y: 310, width: 250, height: 190, access: "public", description: "The golden heart of Original GG. Meet the community, explore the trophy hall and see what the city is building next." },
    { id: "grand-stadium", name: "The Grand Stadium", kind: "stadium", x: 470, y: 590, width: 360, height: 250, access: "public", description: "The home of matchday nights, club showcases and unforgettable football moments." },
    { id: "training-centre", name: "Training Centre", kind: "training", x: 1320, y: 560, width: 300, height: 220, access: "public", description: "Build your routine, log your workout counters and chase new personal bests." },
    { id: "club-district", name: "Club District", kind: "club-district", x: 390, y: 930, width: 340, height: 190, access: "public", description: "A neighbourhood of club grounds. Each approved GG club can grow its own football home here." },
    { id: "residence-gardens", name: "Residence Gardens", kind: "residences", x: 1120, y: 930, width: 330, height: 190, access: "public-exterior", description: "A home district for GG players. Public streets lead to private interiors with owner-controlled visits." },
    { id: "academy-square", name: "Football Academy", kind: "academy", x: 850, y: 760, width: 230, height: 160, access: "public", description: "A place for skill challenges, guided tours and future football lessons." },
    { id: "market-square", name: "Market Square", kind: "market", x: 1510, y: 850, width: 220, height: 150, access: "public", description: "The future home of the GG shop, cosmetics and player unlocks." },
    { id: "garden-park", name: "Garden Park", kind: "park", x: 1450, y: 290, width: 250, height: 180, access: "public", description: "A green pocket of the city with paths, benches and room for your character to hang out." },
  ],
});

const HAIR_STYLES = new Set(["short", "fade", "curly", "long", "afro", "mohawk", "bald"]);
const HAIR_COLORS = new Set(["black", "brown", "blonde", "red", "silver", "blue"]);
const SKIN_TONES = new Set(["deep", "dark", "medium", "tan", "light", "fair"]);
const KIT_COLORS = new Set(["black", "white", "gold", "red", "blue", "green", "purple", "orange"]);
const BOOT_COLORS = new Set(["black", "white", "gold", "red", "blue", "green", "orange"]);

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
      skinTone: enumValue(input.appearance?.skinTone, SKIN_TONES, "medium"),
      hairStyle: enumValue(input.appearance?.hairStyle, HAIR_STYLES, "short"),
      hairColor: enumValue(input.appearance?.hairColor, HAIR_COLORS, "black"),
      kitPrimary: enumValue(input.appearance?.kitPrimary, KIT_COLORS, "black"),
      kitSecondary: enumValue(input.appearance?.kitSecondary, KIT_COLORS, "gold"),
      bootColor: enumValue(input.appearance?.bootColor, BOOT_COLORS, "white"),
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
  const totalReps = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (totalReps < 1 || totalReps > 1500) {
    throw new TypeError("A workout must contain between 1 and 1,500 recorded reps.");
  }

  const durationSeconds = Number(input.durationSeconds);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 28800) {
    throw new TypeError("Workout duration must be between 1 second and 8 hours.");
  }

  return { sessionId, counts, totalReps, durationSeconds };
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

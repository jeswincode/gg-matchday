// Shared, data-driven Original GG character and shop catalogue.
// Add new options/items here; server-side validation and UI choices consume the same definitions.
export const AVATAR_OPTIONS = Object.freeze({
  skinTone: Object.freeze(["deep", "dark", "medium", "tan", "light", "fair"]),
  bodyType: Object.freeze(["slim", "athletic", "stocky"]),
  hairStyle: Object.freeze(["short", "fade", "curly", "long", "afro", "mohawk", "bald", "bun", "ponytail", "spiky", "side-part"]),
  hairColor: Object.freeze(["black", "brown", "blonde", "red", "silver", "blue", "teal", "pink", "white"]),
  kitPrimary: Object.freeze(["black", "white", "gold", "red", "blue", "green", "purple", "orange", "navy", "teal", "pink", "maroon"]),
  kitSecondary: Object.freeze(["black", "white", "gold", "red", "blue", "green", "purple", "orange", "navy", "teal", "pink", "maroon"]),
  bootColor: Object.freeze(["black", "white", "gold", "red", "blue", "green", "orange", "purple", "pink", "cyan"]),
  headAccessory: Object.freeze(["none", "gold-headband", "red-headband", "blue-headband"]),
});

export const WORLD_COSMETIC_CATEGORIES = Object.freeze([
  { id: "hairStyle", label: "Hair styles", slot: "hairStyle" },
  { id: "hairColor", label: "Hair colours", slot: "hairColor" },
  { id: "kit", label: "Kits", slot: "kit" },
  { id: "boots", label: "Boots", slot: "bootColor" },
  { id: "headwear", label: "Headwear", slot: "headAccessory" },
  { id: "furniture", label: "Home furniture", slot: "furniture" },
]);

export const WORLD_COSMETIC_CATALOG = Object.freeze([
  { id: "hair-silver", name: "Silver Hair", category: "hairColor", slot: "hairColor", price: 90, minLevel: 1, description: "A cool silver hairstyle colour.", rarity: "common", collection: "classic", sortOrder: 10, appearancePatch: { hairColor: "silver" } },
  { id: "hair-teal", name: "Teal Hair", category: "hairColor", slot: "hairColor", price: 115, minLevel: 2, description: "A bold teal colour for your footballer.", rarity: "rare", collection: "neon-nights", sortOrder: 20, appearancePatch: { hairColor: "teal" } },
  { id: "hair-pink", name: "Pink Hair", category: "hairColor", slot: "hairColor", price: 115, minLevel: 2, description: "A bright pink hair colour.", rarity: "rare", collection: "neon-nights", sortOrder: 30, appearancePatch: { hairColor: "pink" } },
  { id: "hair-bun", name: "Matchday Bun", category: "hairStyle", slot: "hairStyle", price: 100, minLevel: 1, description: "A tied-back style for matchday.", rarity: "common", collection: "classic", sortOrder: 40, appearancePatch: { hairStyle: "bun" } },
  { id: "hair-ponytail", name: "Runner's Ponytail", category: "hairStyle", slot: "hairStyle", price: 130, minLevel: 2, description: "A practical ponytail style.", rarity: "rare", collection: "training-club", sortOrder: 50, appearancePatch: { hairStyle: "ponytail" } },
  { id: "hair-spiky", name: "Spiky Hair", category: "hairStyle", slot: "hairStyle", price: 130, minLevel: 2, description: "A sharp, energetic pixel style.", rarity: "rare", collection: "street-football", sortOrder: 60, appearancePatch: { hairStyle: "spiky" } },
  { id: "hair-side-part", name: "Classic Side Part", category: "hairStyle", slot: "hairStyle", price: 110, minLevel: 1, description: "A clean classic football look.", rarity: "common", collection: "classic", sortOrder: 70, appearancePatch: { hairStyle: "side-part" } },
  { id: "kit-neon", name: "Neon Training Kit", category: "kit", slot: "kit", price: 180, minLevel: 3, description: "A vivid teal-and-gold training look.", rarity: "rare", collection: "neon-nights", sortOrder: 80, appearancePatch: { kitPrimary: "teal", kitSecondary: "gold" } },
  { id: "kit-royal", name: "Royal Blue Kit", category: "kit", slot: "kit", price: 210, minLevel: 4, description: "A deep navy kit with bright blue trim.", rarity: "epic", collection: "club-legends", sortOrder: 90, appearancePatch: { kitPrimary: "navy", kitSecondary: "blue" } },
  { id: "kit-crimson", name: "Crimson Match Kit", category: "kit", slot: "kit", price: 210, minLevel: 4, description: "A maroon match kit with gold detailing.", rarity: "epic", collection: "club-legends", sortOrder: 100, appearancePatch: { kitPrimary: "maroon", kitSecondary: "gold" } },
  { id: "boots-gold", name: "Golden Boots", category: "boots", slot: "bootColor", price: 120, minLevel: 2, description: "A bright pair of matchday boots.", rarity: "rare", collection: "classic", sortOrder: 110, appearancePatch: { bootColor: "gold" } },
  { id: "boots-neon", name: "Neon Boots", category: "boots", slot: "bootColor", price: 145, minLevel: 3, description: "Electric cyan boots for the training pitch.", rarity: "rare", collection: "neon-nights", sortOrder: 120, appearancePatch: { bootColor: "cyan" } },
  { id: "headband-gold", name: "Golden Headband", category: "headwear", slot: "headAccessory", price: 95, minLevel: 1, description: "A gold headband for your player portrait.", rarity: "common", collection: "classic", sortOrder: 130, appearancePatch: { headAccessory: "gold-headband" } },
  { id: "headband-red", name: "Red Headband", category: "headwear", slot: "headAccessory", price: 105, minLevel: 2, description: "A red headband to finish your kit.", rarity: "common", collection: "street-football", sortOrder: 140, appearancePatch: { headAccessory: "red-headband" } },
  { id: "headband-blue", name: "Blue Headband", category: "headwear", slot: "headAccessory", price: 105, minLevel: 2, description: "A blue headband to finish your kit.", rarity: "common", collection: "street-football", sortOrder: 150, appearancePatch: { headAccessory: "blue-headband" } },
  { id: "furniture-velvet-sofa", name: "Velvet Lounge Sofa", category: "furniture", slot: "furniture", itemType: "furniture", price: 160, minLevel: 2, description: "A deep-green sofa for your player lounge.", rarity: "rare", collection: "home-comforts", sortOrder: 160, furniturePlacement: { roomIds: ["lounge"], displayName: "Velvet Lounge Sofa", furnitureKey: "velvet-sofa" } },
  { id: "furniture-trophy-case", name: "Golden Trophy Case", category: "furniture", slot: "furniture", itemType: "furniture", price: 140, minLevel: 2, description: "A display case for the moments you earn.", rarity: "rare", collection: "home-comforts", sortOrder: 170, furniturePlacement: { roomIds: ["trophy-room"], displayName: "Golden Trophy Case", furnitureKey: "trophy-case" } },
  { id: "furniture-training-rack", name: "Home Training Rack", category: "furniture", slot: "furniture", itemType: "furniture", price: 175, minLevel: 3, description: "A compact training station for your home gym corner.", rarity: "rare", collection: "training-club", sortOrder: 180, furniturePlacement: { roomIds: ["training-corner"], displayName: "Home Training Rack", furnitureKey: "training-rack" } },
]);

export function getWorldCosmetic(itemId) {
  return WORLD_COSMETIC_CATALOG.find((item) => item.id === itemId) || null;
}

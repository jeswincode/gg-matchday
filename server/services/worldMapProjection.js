import { WORLD_MAP_SLUG } from "../config/ggWorldRules.js";

const LOCATION_FIELDS = ["id", "name", "kind", "x", "y", "width", "height", "description"];
const DISTRICT_FIELDS = ["id", "label", "x", "y", "tone"];
const LAYER_FIELDS = ["id", "type", "order"];
function pick(source, fields) {
  const output = {};
  for (const field of fields) if (source?.[field] !== undefined) output[field] = source[field];
  return output;
}

/** Static public projection: no interiors, accounts, plots, homes or gameplay data. */
export function createPublicWorldMapProjection(layout) {
  return {
    slug: WORLD_MAP_SLUG,
    title: "Original GG",
    version: Number(layout?.version || 1),
    orientation: layout?.orientation || "isometric",
    tileWidth: Number(layout?.tileWidth || 128),
    tileHeight: Number(layout?.tileHeight || 64),
    width: Number(layout?.width || 1800),
    height: Number(layout?.height || 1200),
    layers: (Array.isArray(layout?.layers) ? layout.layers : []).map((item) => pick(item, LAYER_FIELDS)),
    districts: (Array.isArray(layout?.districts) ? layout.districts : []).map((item) => pick(item, DISTRICT_FIELDS)),
    locations: (Array.isArray(layout?.locations) ? layout.locations : []).map((item) => pick(item, LOCATION_FIELDS)),
  };
}

export const GLOBAL_MAP_ID = "gg-main-v1";
export const WORLD_MAP_GRID_WIDTH = 60;
export const WORLD_MAP_GRID_HEIGHT = 60;

// Fixed canonical Original GG facilities. These are map configuration, not
// allocatable plots or a template for creating additional football Worlds.
export const DEFAULT_WORLD_FACILITIES = Object.freeze([
  Object.freeze({ facilityKey: "central-stadium", type: "central_stadium", column: 25, row: 25, width: 8, height: 6 }),
  Object.freeze({ facilityKey: "club-district", type: "club_district", column: 37, row: 24, width: 9, height: 9 }),
  Object.freeze({ facilityKey: "construction-grounds", type: "construction_grounds", column: 10, row: 25, width: 8, height: 7 }),
  Object.freeze({ facilityKey: "captains-arena", type: "captains_arena", column: 25, row: 10, width: 8, height: 6 }),
  Object.freeze({ facilityKey: "training-grounds", type: "training_grounds", column: 37, row: 10, width: 9, height: 8 }),
  Object.freeze({ facilityKey: "community-hall", type: "community_hall", column: 10, row: 10, width: 8, height: 6 }),
  Object.freeze({ facilityKey: "hall-of-fame", type: "hall_of_fame", column: 25, row: 40, width: 8, height: 6 }),
  Object.freeze({ facilityKey: "administration", type: "administration", column: 39, row: 41, width: 7, height: 6 }),
]);

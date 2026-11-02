import { useEffect, useId, useMemo, useRef, useState } from "react";
import { gridToScreen } from "./mapProjection.js";
import {
  GLOBAL_MAP_DEMO_MEMBERSHIP,
  GLOBAL_MAP_DEMO_WORLDS,
} from "./globalMapFixtures.js";
import "./global-map-scene.css";

const WIDTH = 1800;
const HEIGHT = 1100;
const TILE_WIDTH = 48;
const TILE_HEIGHT = 24;
const ORIGIN_X = WIDTH / 2;
const ORIGIN_Y = HEIGHT / 2;
const CAMERA_CENTER_X = WIDTH / 2;
const CAMERA_CENTER_Y = HEIGHT / 2;

function project(column, row) {
  return gridToScreen({
    column, row, tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT,
    originX: ORIGIN_X, originY: ORIGIN_Y,
  });
}

function terrain(mapPoints = []) {
  const result = [];
  const coordinates = mapPoints.filter(point =>
    Number.isFinite(point?.x) && Number.isFinite(point?.y),
  );
  let minColumn = -16;
  let maxColumn = 16;
  let minRow = -12;
  let maxRow = 12;
  if (coordinates.length) {
    minColumn = Infinity;
    maxColumn = -Infinity;
    minRow = Infinity;
    maxRow = -Infinity;
    for (const point of coordinates) {
      minColumn = Math.min(minColumn, point.x);
      maxColumn = Math.max(maxColumn, point.x);
      minRow = Math.min(minRow, point.y);
      maxRow = Math.max(maxRow, point.y);
    }
  }
  const spanColumns = maxColumn - minColumn;
  const spanRows = maxRow - minRow;
  const step = Math.max(1, Math.ceil((spanColumns + 36) / 68), Math.ceil((spanRows + 28) / 48));
  const marginColumns = 18 * step;
  const marginRows = 14 * step;
  co¶»§q«^
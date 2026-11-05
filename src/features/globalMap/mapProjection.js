/**
 * Pure isometric grid projection helpers.
 *
 * Persist logical tile coordinates only. Pixel coordinates are derived from
 * the current viewport, tile dimensions and camera origin.
 */

function assertFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(name + " must be a finite number.");
  }
}

function assertPositiveNumber(value, name) {
  assertFiniteNumber(value, name);
  if (value <= 0) {
    throw new RangeError(name + " must be greater than zero.");
  }
}

/**
 * Convert logical tile coordinates to screen-space isometric coordinates.
 *
 * @param {{column:number,row:number,tileWidth:number,tileHeight:number,originX?:number,originY?:number}} input
 * @returns {{x:number,y:number}}
 */
export function gridToScreen({
  column,
  row,
  tileWidth,
  tileHeight,
  originX = 0,
  originY = 0,
}) {
  assertFiniteNumber(column, "column");
  assertFiniteNumber(row, "row");
  assertPositiveNumber(tileWidth, "tileWidth");
  assertPositiveNumber(tileHeight, "tileHeight");
  assertFiniteNumber(originX, "originX");
  assertFiniteNumber(originY, "originY");

  return {
    x: originX + ((column - row) * tileWidth) / 2,
    y: originY + ((column + row) * tileHeight) / 2,
  };
}

/**
 * Convert screen-space coordinates back to logical isometric tile coordinates.
 * By default the result is snapped to the nearest tile for pointer hit testing.
 *
 * @param {{x:number,y:number,tileWidth:number,tileHeight:number,originX?:number,originY?:number,snap?:boolean}} input
 * @returns {{column:number,row:number}}
 */
export function screenToGrid({
  x,
  y,
  tileWidth,
  tileHeight,
  originX = 0,
  originY = 0,
  snap = true,
}) {
  assertFiniteNumber(x, "x");
  assertFiniteNumber(y, "y");
  assertPositiveNumber(tileWidth, "tileWidth");
  assertPositiveNumber(tileHeight, "tileHeight");
  assertFiniteNumber(originX, "originX");
  assertFiniteNumber(originY, "originY");

  if (typeof snap !== "boolean") {
    throw new TypeError("snap must be a boolean.");
  }

  const projectedX = ((x - originX) * 2) / tileWidth;
  const projectedY = ((y - originY) * 2) / tileHeight;
  const column = (projectedX + projectedY) / 2;
  const row = (projectedY - projectedX) / 2;

  return snap
    ? { column: Math.round(column), row: Math.round(row) }
    : { column, row };
}

/**
 * Return the depth key used for deterministic isometric draw ordering.
 * Objects further down the diagonal are drawn later.
 */
export function isometricDepth(column, row) {
  assertFiniteNumber(column, "column");
  assertFiniteNumber(row, "row");
  return column + row;
}

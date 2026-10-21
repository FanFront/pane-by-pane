/**
 * Board geometry is kept in CSS (logical) pixels. The backing canvas may
 * display at a smaller size on narrow/short mobile screens, so touch input
 * must be mapped back from the actual rendered rectangle.
 */
const MIN_CELL = 30;
const MAX_CELL = 72;
const VIEW_GUTTER = 8;

/** Clockwise quarter turns of the board, without changing puzzle coordinates. */
export type BoardRotation = 0 | 90 | 180 | 270;

export interface BoardSize {
  cell: number;
  /** Unrotated puzzle drawing dimensions, used for all cell/edge geometry. */
  logicalWidth: number;
  logicalHeight: number;
  /** CSS canvas dimensions after rotation and uniform viewport fitting. */
  displayWidth: number;
  displayHeight: number;
}

/** Fit the *rotated* rectangle to the viewport, preserving square cells. */
export function sizeBoard(
  columns: number,
  rows: number,
  availableWidth: number,
  availableHeight: number,
  padding: number,
  rotation: BoardRotation = 0,
): BoardSize {
  const quarterTurn = rotation === 90 || rotation === 270;
  const displayColumns = quarterTurn ? rows : columns;
  const displayRows = quarterTurn ? columns : rows;
  const fitCell = Math.floor(Math.min(
    (availableWidth - 2 * padding - VIEW_GUTTER) / displayColumns,
    (availableHeight - 2 * padding - VIEW_GUTTER) / displayRows,
  ));
  // Keep a useful logical drawing size; shrink the *whole* canvas uniformly
  // if it cannot physically fit rather than stretching its axes differently.
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, fitCell));
  const logicalWidth = columns * cell + 2 * padding;
  const logicalHeight = rows * cell + 2 * padding;
  const rotatedWidth = quarterTurn ? logicalHeight : logicalWidth;
  const rotatedHeight = quarterTurn ? logicalWidth : logicalHeight;
  const scale = Math.min(
    1,
    Math.max(1, availableWidth - VIEW_GUTTER) / rotatedWidth,
    Math.max(1, availableHeight - VIEW_GUTTER) / rotatedHeight,
  );
  return {
    cell,
    logicalWidth,
    logicalHeight,
    displayWidth: rotatedWidth * scale,
    displayHeight: rotatedHeight * scale,
  };
}

/**
 * Transform unrotated puzzle coordinates into the canvas backing buffer.
 * Rotate during drawing rather than with CSS, keeping the stage rectangle
 * axis-aligned for pinch, haptics, and accurate hit testing.
 */
export function boardRotationTransform(
  rotation: BoardRotation,
  logicalWidth: number,
  logicalHeight: number,
  dpr: number,
): [number, number, number, number, number, number] {
  switch (rotation) {
    case 90: return [0, dpr, -dpr, 0, logicalHeight * dpr, 0];
    case 180: return [-dpr, 0, 0, -dpr, logicalWidth * dpr, logicalHeight * dpr];
    case 270: return [0, -dpr, dpr, 0, 0, logicalWidth * dpr];
    default: return [dpr, 0, 0, dpr, 0, 0];
  }
}

/** Pointer client coordinates to canvas drawing coordinates (CSS px, not device px). */
export function pointOnBoard(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  logicalWidth: number,
  logicalHeight: number,
): [number, number] {
  if (rect.width <= 0 || rect.height <= 0) return [-1, -1];
  return [
    (clientX - rect.left) * (logicalWidth / rect.width),
    (clientY - rect.top) * (logicalHeight / rect.height),
  ];
}

/** Invert the quarter turn after mapping the actual (possibly zoomed) rect. */
export function pointOnRotatedBoard(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  logicalWidth: number,
  logicalHeight: number,
  rotation: BoardRotation,
): [number, number] {
  if (rect.width <= 0 || rect.height <= 0) return [-1, -1];
  const quarterTurn = rotation === 90 || rotation === 270;
  const [x, y] = pointOnBoard(
    clientX, clientY, rect,
    quarterTurn ? logicalHeight : logicalWidth,
    quarterTurn ? logicalWidth : logicalHeight,
  );
  switch (rotation) {
    case 90: return [y, logicalHeight - x];
    case 180: return [logicalWidth - x, logicalHeight - y];
    case 270: return [logicalWidth - y, x];
    default: return [x, y];
  }
}

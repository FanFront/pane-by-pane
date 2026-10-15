/**
 * Board geometry is kept in CSS (logical) pixels. The backing canvas may
 * display at a smaller size on narrow/short mobile screens, so touch input
 * must be mapped back from the actual rendered rectangle.
 */
const MIN_CELL = 30;
const MAX_CELL = 72;
const VIEW_GUTTER = 8;

export interface BoardSize {
  cell: number;
  logicalWidth: number;
  logicalHeight: number;
  displayWidth: number;
  displayHeight: number;
}

/** Fit without distorting the board or letting a large board cover the dock. */
export function sizeBoard(
  columns: number,
  rows: number,
  availableWidth: number,
  availableHeight: number,
  padding: number,
): BoardSize {
  const fitCell = Math.floor(Math.min(
    (availableWidth - 2 * padding - VIEW_GUTTER) / columns,
    (availableHeight - 2 * padding - VIEW_GUTTER) / rows,
  ));
  // Keep a useful logical drawing size; shrink the *whole* canvas uniformly
  // if it cannot physically fit rather than stretching its axes differently.
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, fitCell));
  const logicalWidth = columns * cell + 2 * padding;
  const logicalHeight = rows * cell + 2 * padding;
  const scale = Math.min(
    1,
    Math.max(1, availableWidth - VIEW_GUTTER) / logicalWidth,
    Math.max(1, availableHeight - VIEW_GUTTER) / logicalHeight,
  );
  return {
    cell,
    logicalWidth,
    logicalHeight,
    displayWidth: logicalWidth * scale,
    displayHeight: logicalHeight * scale,
  };
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

/**
 * Mobile board camera math, independent of DOM and puzzle state.
 * Screen coordinates are CSS pixels (PointerEvent.clientX/Y).
 * The stage has transform-origin center and uses translate(...) scale(...).
 */
export const MIN_BOARD_ZOOM = 1;
export const MAX_BOARD_ZOOM = 5;

export interface BoardView {
  zoom: number;
  panX: number;
  panY: number;
}

export type ScreenPoint = readonly [number, number];

export interface PinchStart {
  view: BoardView;
  midpoint: ScreenPoint;
  distance: number;
  /** Center of the untransformed stage, in viewport/client coordinates. */
  stageCenter: ScreenPoint;
}

export const defaultBoardView = (): BoardView => ({ zoom: 1, panX: 0, panY: 0 });

function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function distance(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Starts a gesture using the stage's untransformed center as the camera origin. */
export function startPinch(a: ScreenPoint, b: ScreenPoint, view: BoardView, stageCenter: ScreenPoint): PinchStart {
  return {
    view: { ...view },
    midpoint: midpoint(a, b),
    distance: Math.max(1, distance(a, b)),
    stageCenter,
  };
}

/**
 * Never allow empty space to be dragged into view.
 * A board smaller than the viewport stays centered in that axis.
 */
export function clampBoardView(
  view: BoardView,
  boardWidth: number,
  boardHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): BoardView {
  const zoom = Math.max(MIN_BOARD_ZOOM, Math.min(MAX_BOARD_ZOOM, view.zoom));
  if (zoom === MIN_BOARD_ZOOM) return defaultBoardView();
  const limitX = Math.max(0, (boardWidth * zoom - viewportWidth) / 2);
  const limitY = Math.max(0, (boardHeight * zoom - viewportHeight) / 2);
  return {
    zoom,
    panX: Math.max(-limitX, Math.min(limitX, view.panX)),
    panY: Math.max(-limitY, Math.min(limitY, view.panY)),
  };
}

/**
 * Keep the board coordinate beneath the *initial* finger midpoint attached to
 * the moving midpoint while pinching. Identical finger motion = pure pan.
 */
export function movePinch(
  start: PinchStart,
  a: ScreenPoint,
  b: ScreenPoint,
  boardWidth: number,
  boardHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): BoardView {
  const center = midpoint(a, b);
  const zoom = Math.max(
    MIN_BOARD_ZOOM,
    Math.min(MAX_BOARD_ZOOM, start.view.zoom * distance(a, b) / start.distance),
  );
  const ratio = zoom / start.view.zoom;
  const relativeX = start.midpoint[0] - start.stageCenter[0] - start.view.panX;
  const relativeY = start.midpoint[1] - start.stageCenter[1] - start.view.panY;
  return clampBoardView({
    zoom,
    panX: center[0] - start.stageCenter[0] - relativeX * ratio,
    panY: center[1] - start.stageCenter[1] - relativeY * ratio,
  }, boardWidth, boardHeight, viewportWidth, viewportHeight);
}

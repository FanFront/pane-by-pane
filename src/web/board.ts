import { edgeBetween, type Grid } from '../engine/grid.ts';
import { parseKey, type ShapeKey } from '../engine/shape.ts';
import type { Puzzle } from '../engine/types.ts';
import type { Hint, Mistake } from './analysis.ts';
import { Haptics } from './haptics.ts';
import { isBoardViewportControl, preventBoardTouchDefault } from './boardTouch.ts';
import { boardRotationTransform, pointOnRotatedBoard, sizeBoard, type BoardRotation } from './boardGeometry.ts';
import { borderEdgesOnStroke, nearestBorder, paintCellsOnStroke, type BoardPoint } from './boardStroke.ts';
import {
  clampBoardView, defaultBoardView, movePinch, startPinch,
  type BoardView, type PinchStart, type ScreenPoint,
} from './boardViewport.ts';
import { HUES, NONE, PlayerState, WALL, huePool } from './model.ts';
import { boardDevicePixelRatio, completionAnimationActive, COMPLETION_FRAME_MS } from './renderPerformance.ts';

/** colour of borders drawn by the player: a graphite sketch line, unlike the dark lead of the window */
const PLAYER_WALL = '#5b5560';
/** lead came: fixed walls, the frame, and the player's borders once the window is done */
const LEAD = '#1d1c21';
const LEAD_LIGHT = 'rgba(255,255,255,0.28)';
/** glass with no colour yet */
const CLEAR_GLASS = '#e4e9ef';
/** clue ink */
const INK = '#17161a';
const CLUE_FONT = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROSE_GLYPHS = ['○', '△', '□', '☆', '◇', '♡'];
const LONG_PRESS_MS = 450;
const MOVE_SLOP = 8;
const BOARD_ROTATION_KEY = 'pbp:boardRotation';

function savedBoardRotation(): BoardRotation {
  try {
    const value = Number(localStorage.getItem(BOARD_ROTATION_KEY));
    if (value === 0 || value === 90 || value === 180 || value === 270) return value;
  } catch { /* Storage may be unavailable in a private browser. */ }
  return 0;
}
/** a second tap on a just-cleared painted cell within this time walls its region instead */
const DOUBLE_TAP_MS = 320;
/** Border band width, as a fraction of the cell size on each side of an edge (was 0.2; halved). */
// Finger tolerance is measured in screen pixels and capped as a fraction of the cell.

export interface BoardCallbacks {
  /** called after any change to the player's marks */
  onChange(): void;
  /** area counter shown/hidden (long press on a cell) */
  onArea(info: { cell: number; count: number } | null): void;
}

type Hit = { cell: number; zone: 'inner' | 'band'; edge: number };

/**
 * Canvas board with touch-first gestures. Nothing changes on pointer-down;
 * the gesture is decided by what happens next, so a drag that starts near a
 * border never leaves a stray wall behind:
 *   tap empty cell          start a new paint region (auto colour)
 *   tap painted cell        erase that cell (press-and-drag from it extends instead)
 *   double-tap painted cell walls the whole region (the first tap's erase is taken back)
 *   drag (from anywhere)    paint: extend the region of the start cell (never across a wall);
 *                           if the drag's first new cell is already part of that same
 *                           region, the whole stroke erases instead (a quick way to clear
 *                           a region without switching to eraser mode)
 *   tap on a border         toggle a wall; drag along borders to draw/erase a continuous line
 *   long-press on a cell    show the size of its paint region, or of the empty area around it
 *   eraser mode             tap/drag removes paint (walls are removed by tapping them)
 */
export class Board {
  readonly canvas: HTMLCanvasElement;
  /** wraps the canvas; receives the gestures (on iOS a switch on top of the canvas gets the touches) */
  private stage: HTMLElement;
  /** Clipped play area between the rule strip and the bottom toolbar. */
  private viewport: HTMLElement;
  /** the stone wall around the window (#board-wrap) */
  private wrap: HTMLElement;
  private resetViewButton: HTMLButtonElement;
  private rotateButton: HTMLButtonElement;
  private rotationAngle: HTMLElement;
  private rotation: BoardRotation = savedBoardRotation();
  private haptics: Haptics;
  private ctx: CanvasRenderingContext2D;
  puzzle: Puzzle | null = null;
  grid: Grid | null = null;
  ps: PlayerState | null = null;
  eraser = false;
  /** when set, this state is drawn instead of the player's and input is ignored (solution reveal) */
  reveal: PlayerState | null = null;
  hint: Hint | Mistake | null = null;
  /** 1 = where to look, 2 = what to do */
  hintStage = 1;
  /** cells violating a rule (drawn with dark-red hatching) */
  errors: Set<number> = new Set();
  /** fixed walls the player painted across (drawn hatched) */
  errorEdges: Set<number> = new Set();
  private hatch: CanvasPattern | null = null;
  private grain: CanvasPattern | null = null;
  /** the window is finished by the player (lights up) */
  private complete = false;
  /** 0 = puzzle in progress, 1 = finished window; animated between the two */
  private lit = 0;
  private litFrom = 0;
  private litT0 = 0;
  private litDur = 1;
  /** when the play of light on the finished window began */
  private shineT0 = 0;
  private now = 0;
  private anim: number | null = null;
  private drawRequest: number | null = null;
  private cell = 64;
  private pad = 12;
  /** Drawing dimensions before any mobile display scaling. */
  private logicalWidth = 0;
  private logicalHeight = 0;
  private cb: BoardCallbacks;

  // Camera state: stage transform only; painting always uses logical canvas coordinates.
  private view: BoardView = defaultBoardView();
  private touchPoints = new Map<number, ScreenPoint>();
  private pinch: PinchStart | null = null;
  /** Prevent the remaining finger from painting when a pinch ends. */
  private blockPainting = false;

  // gesture state
  private pointerId = -1;
  /** Touch slop is measured in visible screen pixels, not scaled board pixels. */
  private downClientPos: [number, number] = [0, 0];
  private downHit: Hit | null = null;
  private moved = false;
  private changed = false;
  private gesture: 'none' | 'paint' | 'wall' | 'consumed' = 'none';
  private lastBoardPos: BoardPoint | null = null;
  private strokeWallValue: 0 | 1 = WALL;
  private strokeEdges = new Set<number>();
  /** decided lazily, the first time a paint drag reaches a cell other than the start cell */
  private dragMode: 'extend' | 'erase' | null = null;
  private brush = 0;
  private longTimer: number | null = null;
  private areaCells: number[] | null = null;
  /** the painted cell a tap just cleared, for the double-tap that walls its region */
  private lastErase: { cell: number; at: number } | null = null;

  constructor(canvas: HTMLCanvasElement, cb: BoardCallbacks) {
    this.canvas = canvas;
    this.stage = canvas.parentElement!;
    this.viewport = this.stage.parentElement!;
    this.wrap = this.viewport.parentElement!;
    this.resetViewButton = this.viewport.querySelector<HTMLButtonElement>('#board-reset')!;
    this.rotateButton = this.viewport.querySelector<HTMLButtonElement>('#board-rotate')!;
    this.rotationAngle = this.rotateButton.querySelector<HTMLElement>('#board-rotation-angle')!;
    this.rotationAngle.textContent = `${this.rotation}°`;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.haptics = new Haptics(this.stage, canvas);
    // Listening and capturing on the viewport lets a second finger land in
    // the play-area margin, and preserves the gesture outside the stage.
    const viewport = this.viewport;
    viewport.addEventListener('pointerdown', (e) => this.onDown(e));
    viewport.addEventListener('pointermove', (e) => this.onMove(e));
    viewport.addEventListener('pointerup', (e) => this.onUp(e));
    viewport.addEventListener('pointercancel', (e) => this.onCancel(e));
    viewport.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resetViewButton.addEventListener('click', () => this.resetView());
    this.rotateButton.addEventListener('click', () => this.rotateBoard());
    // Block browser zoom/selection during board gestures, but do not cancel
    // touchstart/touchend on the overlay buttons: that suppresses their click
    // events on Android WebView and mobile Chrome. iOS haptics instead relies
    // on native touch handling for the invisible switch over the board.
    if (!this.haptics.overlay) for (const t of ['touchstart', 'touchmove', 'touchend'] as const) {
      viewport.addEventListener(t, preventBoardTouchDefault, { passive: false });
    }
    window.addEventListener('resize', () => this.layout());
  }

  setPuzzle(p: Puzzle, ps: PlayerState): void {
    this.puzzle = p;
    this.ps = ps;
    this.grid = ps.grid;
    this.reveal = null;
    this.hint = null;
    this.errors = new Set();
    this.errorEdges = new Set();
    this.brush = 0;
    this.cancelLongPress();
    this.touchPoints.clear();
    this.pinch = null;
    this.blockPainting = false;
    this.pointerId = -1;
    this.lastBoardPos = null;
    this.strokeEdges.clear();
    this.haptics.end(false);
    this.resetView();
    // A different puzzle must not inherit an in-flight victory animation.
    if (this.anim !== null) cancelAnimationFrame(this.anim);
    if (this.drawRequest !== null) cancelAnimationFrame(this.drawRequest);
    this.anim = null;
    this.drawRequest = null;
    this.complete = false;
    this.lit = 0;
    this.litFrom = 0;
    this.canvas.classList.remove('lit');
    this.wrap.classList.remove('lit');
    this.layout();
  }

  // -- geometry ----------------------------------------------------------------

  layout(): void {
    if (!this.grid) return;
    // The flex viewport already excludes the rule strip and toolbar. Query
    // its actual inner dimensions instead of estimating the occupied space.
    const size = sizeBoard(
      this.grid.w, this.grid.h,
      this.viewport.clientWidth, this.viewport.clientHeight, this.pad, this.rotation,
    );
    this.cell = size.cell;
    this.logicalWidth = size.logicalWidth;
    this.logicalHeight = size.logicalHeight;
    const dpr = boardDevicePixelRatio(window.devicePixelRatio || 1);
    // The CSS size retains logical aspect and input mapping, independently of DPR.
    this.canvas.style.width = `${size.displayWidth}px`;
    this.canvas.style.height = `${size.displayHeight}px`;
    const quarterTurn = this.rotation === 90 || this.rotation === 270;
    const width = Math.round((quarterTurn ? size.logicalHeight : size.logicalWidth) * dpr);
    const height = Math.round((quarterTurn ? size.logicalWidth : size.logicalHeight) * dpr);
    // Assigning canvas.width/height clears and reallocates its backing buffer.
    // Avoid doing so when a toolbar or completion status changes but its size does not.
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.ctx.setTransform(...boardRotationTransform(this.rotation, this.logicalWidth, this.logicalHeight, dpr));
    this.applyView();
    this.draw();
  }

  /** Clockwise quarter-turns change only the view, never the puzzle state. */
  private rotateBoard(): void {
    this.stopPainting();
    this.touchPoints.clear();
    this.pinch = null;
    this.blockPainting = false;
    this.lastErase = null;
    this.rotation = ((this.rotation + 90) % 360) as BoardRotation;
    this.rotationAngle.textContent = `${this.rotation}°`;
    try {
      localStorage.setItem(BOARD_ROTATION_KEY, String(this.rotation));
    } catch { /* Rotating must work even without persistent storage. */ }
    // A different aspect ratio needs a fresh fit, not the previous zoom/pan.
    this.view = defaultBoardView();
    this.layout();
  }

  /** Show the entire board again without changing the puzzle's marks. */
  private resetView(): void {
    this.view = defaultBoardView();
    this.applyView();
  }

  private applyView(): void {
    this.view = clampBoardView(
      this.view,
      this.stage.clientWidth, this.stage.clientHeight,
      this.viewport.clientWidth, this.viewport.clientHeight,
    );
    const { zoom, panX, panY } = this.view;
    this.stage.style.transform = zoom === 1 ? '' : `translate(${panX}px, ${panY}px) scale(${zoom})`;
    this.resetViewButton.hidden = zoom === 1;
  }

  private beginPinch(): void {
    // A finger already painting is finalized without a new tap or wall.
    this.stopPainting();
    this.lastErase = null;
    this.blockPainting = true;
    const [a, b] = [...this.touchPoints.values()];
    const rect = this.stage.getBoundingClientRect();
    // getBoundingClientRect includes the existing CSS translation; recover the
    // center of the *untransformed* stage so a new pinch cannot jump.
    const stageCenter: ScreenPoint = [
      rect.left + rect.width / 2 - this.view.panX,
      rect.top + rect.height / 2 - this.view.panY,
    ];
    this.pinch = startPinch(a, b, this.view, stageCenter);
  }

  private updatePinch(): void {
    if (!this.pinch || this.touchPoints.size < 2) return;
    const [a, b] = [...this.touchPoints.values()];
    this.view = movePinch(
      this.pinch, a, b,
      this.stage.clientWidth, this.stage.clientHeight,
      this.viewport.clientWidth, this.viewport.clientHeight,
    );
    this.applyView();
  }

  private borderTolerance(): number {
    const scale = this.logicalWidth > 0
      ? this.canvas.getBoundingClientRect().width /
        (this.rotation === 90 || this.rotation === 270 ? this.logicalHeight : this.logicalWidth) : 1;
    return Math.min(this.cell * 0.24, 11 / Math.max(0.1, scale));
  }

  private hit(px: number, py: number): Hit | null {
    const g = this.grid!;
    const x = Math.floor((px - this.pad) / this.cell);
    const y = Math.floor((py - this.pad) / this.cell);
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
    const c = y * g.w + x;
    if (!g.active[c]) return null;
    const edge = nearestBorder(g, this.pad, this.cell, [px, py], this.borderTolerance());
    return edge >= 0 ? { cell: c, zone: 'band', edge } : { cell: c, zone: 'inner', edge: -1 };
  }

  private pos(e: PointerEvent): [number, number] {
    return pointOnRotatedBoard(
      e.clientX, e.clientY,
      this.canvas.getBoundingClientRect(),
      this.logicalWidth, this.logicalHeight, this.rotation,
    );
  }

  // -- gestures ----------------------------------------------------------------

  private onDown(e: PointerEvent): void {
    if (!this.ps || this.reveal || isBoardViewportControl(e.target)) return;
    if (e.pointerType === 'touch') {
      // A third finger must not replace either of the two tracked fingers.
      if (this.touchPoints.size >= 2) return;
      this.touchPoints.set(e.pointerId, [e.clientX, e.clientY]);
      this.viewport.setPointerCapture(e.pointerId);
      if (this.touchPoints.size === 2) {
        e.preventDefault();
        this.beginPinch();
        return;
      }
    }
    if (this.blockPainting || this.pointerId !== -1) return;
    const p = this.pos(e);
    const hit = this.hit(...p);
    if (!hit) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    if (!this.viewport.hasPointerCapture(e.pointerId)) this.viewport.setPointerCapture(e.pointerId);
    this.haptics.begin();
    this.downClientPos = [e.clientX, e.clientY];
    this.downHit = hit;
    this.moved = false;
    this.changed = false;
    this.gesture = 'none';
    this.dragMode = null;
    this.lastBoardPos = p;
    this.strokeEdges.clear();
    this.strokeWallValue = this.eraser || (hit.edge >= 0 && this.ps.edge[hit.edge] === WALL) ? NONE : WALL;
    this.hint = null;
    const ps = this.ps;
    // Nothing is changed yet: a wall waits for release, paint waits for a tap or a move.
    this.brush = this.eraser ? 0 : ps.paint[hit.cell];
    if (hit.zone === 'band' || this.eraser) return;
    this.startLongPress(() => {
      const { count, cells } = ps.areaOf(hit.cell);
      this.areaCells = cells;
      this.cb.onArea({ cell: hit.cell, count });
      this.gesture = 'consumed';
      this.requestDraw();
    });
  }

  private onMove(e: PointerEvent): void {
    if (this.touchPoints.has(e.pointerId)) {
      this.touchPoints.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.pinch) {
        e.preventDefault();
        this.updatePinch();
        return;
      }
    }
    if (this.blockPainting || !this.ps || e.pointerId !== this.pointerId) return;
    const p = this.pos(e);
    if (!this.moved && Math.hypot(e.clientX - this.downClientPos[0], e.clientY - this.downClientPos[1]) > MOVE_SLOP) {
      this.moved = true;
      this.cancelLongPress();
    }
    if (!this.moved || this.gesture === 'consumed') return;
    const ps = this.ps;
    const start = this.downHit!;
    const from = this.lastBoardPos ?? this.pos(e);
    if (this.gesture === 'none') {
      // An intentional line drag must begin on a boundary and remain near it.
      // A stroke moving away from the edge still paints as before.
      const verticalEdge = start.edge >= 0 &&
        ps.grid.edgeB[start.edge] === ps.grid.edgeA[start.edge] + 1;
      const dx = Math.abs(p[0] - from[0]), dy = Math.abs(p[1] - from[1]);
      const followsStart = verticalEdge ? dy >= dx : dx >= dy;
      const alongBorder = start.zone === 'band' && followsStart &&
        nearestBorder(ps.grid, this.pad, this.cell, p, this.borderTolerance(),
          verticalEdge ? 'vertical' : 'horizontal') >= 0;
      this.gesture = alongBorder ? 'wall' : 'paint';
      if (this.gesture === 'paint') {
        if (this.eraser) {
          if (ps.paint[start.cell]) this.change(() => ps.erasePaint(start.cell));
        } else if (!this.brush) {
          this.change(() => { this.brush = ps.newRegion(start.cell); });
        }
      }
    }
    if (this.gesture === 'wall') {
      for (const edge of borderEdgesOnStroke(ps.grid, this.pad, this.cell, from, p, this.borderTolerance())) {
        if (this.strokeEdges.has(edge)) continue;
        this.strokeEdges.add(edge);
        if (!ps.fixed[edge] && ps.edge[edge] !== this.strokeWallValue) {
          this.change(() => ps.setEdge(edge, this.strokeWallValue));
        }
      }
      this.lastBoardPos = p;
      return;
    }
    // Replay all intermediate cells (fast or coalesced touch events may skip many).
    for (const cell of paintCellsOnStroke(ps.grid, this.pad, this.cell, from, p)) {
      if (this.eraser) {
        if (ps.paint[cell]) this.change(() => ps.erasePaint(cell));
        continue;
      }
      if (!this.brush) continue;
      if (this.dragMode === null && cell !== start.cell) {
        this.dragMode = ps.paint[cell] === this.brush ? 'erase' : 'extend';
        if (this.dragMode === 'erase' && ps.paint[start.cell]) {
          this.change(() => ps.erasePaint(start.cell));
        }
      }
      if (this.dragMode === 'erase') {
        if (ps.paint[cell]) this.change(() => ps.erasePaint(cell));
      } else if (ps.canExtend(cell, this.brush)) {
        this.change(() => ps.extend(cell, this.brush));
      }
    }
    this.lastBoardPos = p;
  }

  private onUp(e: PointerEvent): void {
    this.releasePointer(e, true);
  }

  private onCancel(e: PointerEvent): void {
    this.releasePointer(e, false);
  }

  private releasePointer(e: PointerEvent, allowTap: boolean): void {
    this.touchPoints.delete(e.pointerId);
    if (this.viewport.hasPointerCapture(e.pointerId)) this.viewport.releasePointerCapture(e.pointerId);
    if (this.blockPainting) {
      if (this.touchPoints.size < 2) this.pinch = null;
      if (this.touchPoints.size === 0) this.blockPainting = false;
      return; // No painting when one finger remains after a pinch.
    }
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    this.cancelLongPress();
    if (this.areaCells) {
      this.areaCells = null;
      this.cb.onArea(null);
      this.requestDraw();
    }
    const ps = this.ps;
    const hit = this.downHit;
    if (!ps || !hit) {
      this.haptics.end(false);
      return;
    }
    const tap = allowTap && !this.moved && this.gesture === 'none';
    const now = performance.now();
    const doubleTap = tap && hit.zone === 'inner' && this.lastErase !== null && this.lastErase.cell === hit.cell && now - this.lastErase.at < DOUBLE_TAP_MS;
    this.lastErase = null;
    if (doubleTap) {
      // Second tap on the cell the first tap cleared: take the erase back and
      // wall the region instead (the original's Shift+click).
      ps.undo();
      const id = ps.paint[hit.cell];
      if (id) this.change(() => ps.wallAround(id));
      else this.changed = true;
    } else if (tap && hit.zone === 'band') {
      // walls toggle on release only, so a drag that began near a border paints instead
      if (!ps.fixed[hit.edge]) this.change(() => ps.toggleWall(hit.edge));
    } else if (tap && ps.paint[hit.cell]) {
      // a plain tap on a painted cell erases it (in eraser mode too)
      this.change(() => ps.erasePaint(hit.cell));
      this.lastErase = { cell: hit.cell, at: now };
    } else if (tap && !this.eraser) {
      this.change(() => ps.newRegion(hit.cell));
    }
    this.haptics.end(allowTap && this.changed);
    if (this.changed) this.cb.onChange();
    this.changed = false;
    this.downHit = null;
    this.lastBoardPos = null;
    this.strokeEdges.clear();
    this.requestDraw();
  }

  /** Finish a pending paint stroke when a second finger joins. */
  private stopPainting(): void {
    this.cancelLongPress();
    if (this.areaCells) {
      this.areaCells = null;
      this.cb.onArea(null);
    }
    this.pointerId = -1;
    this.downHit = null;
    this.lastBoardPos = null;
    this.strokeEdges.clear();
    this.haptics.end(false);
    if (this.changed) this.cb.onChange();
    this.changed = false;
    this.requestDraw();
  }

  /** Apply a state change inside one undo step per gesture. */
  private change(fn: () => void): void {
    if (!this.ps) return;
    if (!this.changed) {
      this.ps.beginChange();
      this.changed = true;
    }
    fn();
    this.haptics.tick();
    this.requestDraw();
  }

  private startLongPress(fn: () => void): void {
    this.cancelLongPress();
    this.longTimer = window.setTimeout(() => {
      this.longTimer = null;
      fn();
    }, LONG_PRESS_MS);
  }

  private cancelLongPress(): void {
    if (this.longTimer !== null) {
      clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }

  // -- drawing -------------------------------------------------------------------

  private edgeSegment(e: number): [number, number, number, number] {
    const g = this.grid!;
    const a = g.edgeA[e];
    const ax = a % g.w;
    const ay = (a - ax) / g.w;
    const s = this.cell;
    const p = this.pad;
    if (g.edgeB[e] === a + 1) {
      const x = p + (ax + 1) * s;
      return [x, p + ay * s, x, p + (ay + 1) * s];
    }
    const y = p + (ay + 1) * s;
    return [p + ax * s, y, p + (ax + 1) * s, y];
  }

  /**
   * Completion: the window "lights up". The player's borders become leading,
   * the glass deepens and glows, cutting lines and clues fade, and light plays
   * over the glass for as long as the window stays finished. Never used for
   * the solution reveal.
   */
  setComplete(done: boolean): void {
    if (done === this.complete) return;
    this.complete = done;
    this.canvas.classList.toggle('lit', done);
    this.wrap.classList.toggle('lit', done);
    this.litFrom = this.lit;
    this.litT0 = performance.now();
    this.litDur = done ? 1100 : 350;
    if (done) this.shineT0 = this.litT0 + 400;
    if (this.anim === null) this.anim = requestAnimationFrame((t) => this.tick(t));
  }

  /** One animation frame: the light ramp, then the play of light while finished. */
  private tick(now: number): void {
    const k = Math.min(1, (now - this.litT0) / this.litDur);
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.lit = this.litFrom + ((this.complete ? 1 : 0) - this.litFrom) * ease;
    // the play of light is slow: half the frame rate is plenty once the ramp is over
    const more = completionAnimationActive(
      now, this.litT0, this.litDur, this.shineT0,
      this.complete, REDUCED_MOTION, this.reveal !== null,
    );
    // Paint at most ~30 FPS during the short transition; always draw its final frame.
    if (now - this.now >= COMPLETION_FRAME_MS || !more) {
      this.now = now;
      this.draw();
    }
    this.anim = more ? requestAnimationFrame((t) => this.tick(t)) : null;
  }

  /** Schedule at most one board draw per browser frame during rapid input. */
  requestDraw(): void {
    if (this.drawRequest !== null) return;
    this.drawRequest = requestAnimationFrame(() => {
      this.drawRequest = null;
      this.draw();
    });
  }

  /**
   * Light on the finished glass: a sunbeam sweeping across the window (strong
   * once, then faintly every so often) and two soft patches of light that drift
   * slowly, as if clouds were passing outside.
   */
  private drawShine(): void {
    const g = this.grid!;
    const ctx = this.ctx;
    const s = this.cell;
    const pad = this.pad;
    const t = (this.now - this.shineT0) / 1000;
    if (t < 0) return;
    const W = g.w * s;
    const H = g.h * s;
    ctx.save();
    ctx.beginPath();
    for (let c = 0; c < g.cells; c++) if (g.active[c]) ctx.rect(pad + (c % g.w) * s, pad + Math.floor(c / g.w) * s, s, s);
    ctx.clip();

    // drifting patches of light
    const cx = pad + W / 2;
    const cy = pad + H / 2;
    const R = Math.max(W, H);
    const patches: [number, number, number, number][] = [
      [cx + 0.32 * W * Math.sin(t * 0.21), cy + 0.28 * H * Math.cos(t * 0.17 + 1), 0.55 * R, 0.2],
      [cx + 0.3 * W * Math.cos(t * 0.13 + 2), cy + 0.3 * H * Math.sin(t * 0.19 + 3), 0.45 * R, 0.14],
    ];
    const fade = Math.min(1, t / 2.5);
    for (const [px, py, r, a] of patches) {
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(255,244,220,${a * fade})`);
      grad.addColorStop(1, 'rgba(255,244,220,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(pad, pad, W, H);
    }

    // sunbeam: a soft diagonal band crossing the window from top-left to bottom-right
    const PERIOD = 14;
    const SWEEP = 2.4;
    const phase = t % PERIOD;
    if (phase < SWEEP) {
      const first = t < PERIOD;
      const u = phase / SWEEP;
      const eased = u * u * (3 - 2 * u);
      const d = Math.SQRT1_2;
      const pMin = (pad + pad) * d;
      const pMax = (pad + W + pad + H) * d;
      const w = 0.18 * (pMax - pMin);
      const c = pMin - w + (pMax - pMin + 2 * w) * eased;
      const grad = ctx.createLinearGradient((c - w) * d, (c - w) * d, (c + w) * d, (c + w) * d);
      const a = (first ? 0.8 : 0.4) * Math.sin(Math.PI * u);
      grad.addColorStop(0, 'rgba(255,250,235,0)');
      grad.addColorStop(0.35, `rgba(255,250,235,${a * 0.35})`);
      grad.addColorStop(0.5, `rgba(255,252,240,${a})`);
      grad.addColorStop(0.65, `rgba(255,250,235,${a * 0.35})`);
      grad.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(pad, pad, W, H);
    }
    ctx.restore();
  }

  draw(): void {
    // A forced layout/animation draw supersedes a pending input redraw.
    if (this.drawRequest !== null) {
      cancelAnimationFrame(this.drawRequest);
      this.drawRequest = null;
    }
    const g = this.grid;
    const p = this.puzzle;
    const ps = this.reveal ?? this.ps;
    const ctx = this.ctx;
    if (!g || !p || !ps) return;
    const s = this.cell;
    const pad = this.pad;
    const lit = this.reveal ? 0 : this.lit;
    // Clear in device pixels: the board drawing transform may be rotated.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    if (!this.hatch) this.hatch = makeHatch(ctx);
    if (!this.grain) this.grain = makeGrain(ctx);
    const cellX = (c: number) => pad + (c % g.w) * s;
    const cellY = (c: number) => pad + Math.floor(c / g.w) * s;

    // -- glass ------------------------------------------------------------------
    // Each paint region is one pane: a flat colour, then light coming through
    // from behind (a radial highlight over the pane), then the grain of the glass.
    const panes = new Map<number, { x0: number; y0: number; x1: number; y1: number; cells: number[] }>();
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      const id = ps.paint[c];
      const x = c % g.w;
      const y = (c - x) / g.w;
      let b = panes.get(id);
      if (!b) panes.set(id, (b = { x0: x, y0: y, x1: x, y1: y, cells: [] }));
      b.x0 = Math.min(b.x0, x);
      b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x);
      b.y1 = Math.max(b.y1, y);
      b.cells.push(c);
    }
    for (const [id, b] of panes) {
      const painted = id > 0;
      const base = painted ? HUES[ps.hue[id] ?? 0] : CLEAR_GLASS;
      ctx.save();
      ctx.beginPath();
      for (const c of b.cells) ctx.rect(cellX(c), cellY(c), s, s);
      ctx.clip();
      ctx.fillStyle = painted && lit > 0 ? mix(base, deepen(base), lit) : base;
      ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
      if (painted) {
        // light behind the pane, centred a little above the middle
        const cx = pad + ((b.x0 + b.x1 + 1) / 2) * s;
        const cy = pad + ((b.y0 + b.y1 + 1) / 2) * s - s * 0.15;
        const r = Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) * s * 0.8;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(255,255,255,${0.3 + 0.25 * lit})`);
        grad.addColorStop(0.55, `rgba(255,255,255,${0.08 + 0.1 * lit})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        ctx.fillStyle = `rgba(20,10,40,${0.05 * (1 - lit)})`;
        ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
      } else {
        // clear glass: cool, with a faint sheen from the top-left
        const grad = ctx.createLinearGradient(pad + b.x0 * s, pad + b.y0 * s, pad + (b.x1 + 1) * s, pad + (b.y1 + 1) * s);
        grad.addColorStop(0, 'rgba(255,255,255,0.7)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
      }
      if (this.grain) {
        ctx.globalAlpha = painted ? 0.7 : 0.35;
        ctx.fillStyle = this.grain;
        ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // cells that carry a clue: their error hatching leaves the middle clear so the clue stays readable
    const clueCells = new Set<number>();
    for (const clue of p.clues) {
      if (clue.type === 'areaNumber' || clue.type === 'polyomino' || clue.type === 'palisade' || clue.type === 'fenceShape' || clue.type === 'compass') clueCells.add(clue.cell);
      else if (clue.type === 'rose') for (const sym of clue.symbols) clueCells.add(sym.cell);
    }
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      if (this.errors.has(c) && this.hatch) {
        ctx.fillStyle = this.hatch;
        const x = cellX(c);
        const y = cellY(c);
        if (clueCells.has(c)) {
          const t = Math.max(6, s * 0.2);
          ctx.fillRect(x, y, s, t);
          ctx.fillRect(x, y + s - t, s, t);
          ctx.fillRect(x, y + t, t, s - 2 * t);
          ctx.fillRect(x + s - t, y + t, t, s - 2 * t);
        } else {
          ctx.fillRect(x, y, s, s);
        }
      }
      if (this.areaCells?.includes(c)) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(cellX(c), cellY(c), s, s);
      }
    }

    // cutting lines between cells whose border is undecided (they vanish when the window is done)
    if (lit < 1) {
      ctx.strokeStyle = `rgba(30,25,40,${0.28 * (1 - lit)})`;
      ctx.lineWidth = 1;
      const dashes = s >= 56 ? 8 : s >= 40 ? 7 : 6;
      const unit = s / (dashes * 2 - 1);
      ctx.setLineDash([unit, unit]);
      ctx.beginPath();
      for (let e = 0; e < g.edges; e++) {
        if (ps.edge[e] !== NONE || ps.fixed[e]) continue;
        const [x1, y1, x2, y2] = this.edgeSegment(e);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // clues, etched into the glass (they fade once the window is done)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1 - 0.6 * lit;
    const clueFont = `600 ${Math.round(s * 0.42)}px ${CLUE_FONT}`;
    for (const clue of p.clues) {
      if (clue.type === 'areaNumber') this.text(String(clue.value), clue.cell, clueFont);
      else if (clue.type === 'rose') for (const sym of clue.symbols) this.text(ROSE_GLYPHS[sym.symbol] ?? String(sym.symbol), sym.cell, `${Math.round(s * 0.42)}px sans-serif`);
      else if (clue.type === 'polyomino') this.miniShape(clue.shape, clue.cell);
      else if (clue.type === 'palisade' || clue.type === 'fenceShape') this.palisadeTile(clue.sides, clue.cell);
      else if (clue.type === 'compass') {
        const label = [['↑', clue.up], ['↓', clue.down], ['←', clue.left], ['→', clue.right]]
          .filter(([, n]) => Number(n) >= 0).map(([dir, n]) => `${dir}${n}`).join(' ');
        this.text(label || '✧', clue.cell, `600 ${Math.round(s * 0.18)}px sans-serif`);
      }
    }
    ctx.globalAlpha = 1;
    if (lit > 0 && this.complete) this.drawShine();

    // hint
    if (this.hint?.kind === 'step') {
      const h = this.hint;
      // stage 1: tint the region the reasoning is about
      ctx.fillStyle = 'rgba(255,196,0,0.4)';
      for (const c of h.region) ctx.fillRect(cellX(c), cellY(c), s, s);
      if (this.hintStage >= 2) {
        if (h.value === 'wall') {
          const [x1, y1, x2, y2] = this.edgeSegment(h.edge);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (h.focus >= 0) {
          // the cell to add: outlined, with an arrow-ish dash on the shared edge
          const fx = cellX(h.focus);
          const fy = cellY(h.focus);
          ctx.fillStyle = 'rgba(255,196,0,0.4)';
          ctx.fillRect(fx, fy, s, s);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(fx + 3, fy + 3, s - 6, s - 6);
          ctx.setLineDash([]);
        }
      }
    } else if (this.hint?.kind === 'mistake') {
      const m = this.hint;
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      for (const c of m.cells) ctx.strokeRect(cellX(c) + 3, cellY(c) + 3, s - 6, s - 6);
      ctx.setLineDash([]);
      // a wrong wall is recoloured in the wall pass below
    }

    // -- leading -----------------------------------------------------------------
    // Fixed walls and the frame are the lead came of the window. The player's
    // borders are a graphite sketch until the window is done, then they become lead too.
    const lead: [number, number, number, number][] = [];
    const leadW = 5 + 1.5 * lit;
    // Corners touched by lead (fixed walls, even a bad one still drawn thick, and the
    // frame) are collected first: a player-drawn wall needs a bigger gap there to clear
    // the lead's own thickness, or the gap just reads as "swallowed" by the black line.
    const leadCorners = new Set<string>();
    const corner = (x: number, y: number) => leadCorners.add(`${Math.round(x)},${Math.round(y)}`);
    for (let e = 0; e < g.edges; e++) {
      if (ps.fixed[e] !== 1) continue;
      const seg = this.edgeSegment(e);
      corner(seg[0], seg[1]);
      corner(seg[2], seg[3]);
      if (!this.errorEdges.has(e)) lead.push(seg);
    }
    // outer frame: every side of an active cell facing a hole or the outside
    const act = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && g.active[ny * g.w + nx] === 1;
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      const x = c % g.w;
      const y = (c - x) / g.w;
      const X0 = pad + x * s;
      const Y0 = pad + y * s;
      const sides: [number, number, number, number][] = [];
      if (!act(x - 1, y)) sides.push([X0, Y0, X0, Y0 + s]);
      if (!act(x + 1, y)) sides.push([X0 + s, Y0, X0 + s, Y0 + s]);
      if (!act(x, y - 1)) sides.push([X0, Y0, X0 + s, Y0]);
      if (!act(x, y + 1)) sides.push([X0, Y0 + s, X0 + s, Y0 + s]);
      for (const seg of sides) {
        corner(seg[0], seg[1]);
        corner(seg[2], seg[3]);
        lead.push(seg);
      }
    }
    // baseGap: a small breathing room between two player-drawn strokes that share a
    // corner. leadGap: enough to actually clear the lead's own half-width, so the gap
    // isn't just painted back over once the lead is stroked (see strokeLead below).
    const baseGap = 3 * (1 - lit);
    const leadGap = (leadW / 2 + 3) * (1 - lit);
    for (let e = 0; e < g.edges; e++) {
      const fixed = ps.fixed[e] === 1;
      if (!fixed && ps.edge[e] !== WALL) continue;
      const bad = this.errorEdges.has(e);
      if (fixed && !bad) continue; // already in `lead`, drawn below
      const seg = this.edgeSegment(e);
      const wrong = this.hint?.kind === 'mistake' && this.hint.edge === e;
      const [x1, y1, x2, y2] = seg;
      let [sx1, sy1, sx2, sy2] = seg;
      if (!fixed) {
        const g1 = leadCorners.has(`${Math.round(x1)},${Math.round(y1)}`) ? leadGap : baseGap;
        const g2 = leadCorners.has(`${Math.round(x2)},${Math.round(y2)}`) ? leadGap : baseGap;
        if (x1 === x2) {
          sy1 += g1;
          sy2 -= g2;
        } else {
          sx1 += g1;
          sx2 -= g2;
        }
      }
      ctx.strokeStyle = bad ? '#7f1d1d' : wrong ? '#dc2626' : lit > 0 ? mix(PLAYER_WALL, LEAD, lit) : PLAYER_WALL;
      ctx.lineWidth = fixed ? 5 : wrong ? 7 : 3 + (leadW - 3) * lit;
      ctx.lineCap = fixed || lit > 0.5 ? 'square' : 'round';
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
      if (bad && this.hatch) {
        // a hatched band across the wall, like the original's error mark
        const t = Math.max(10, s * 0.28);
        ctx.fillStyle = this.hatch;
        if (x1 === x2) ctx.fillRect(x1 - t / 2, y1, t, y2 - y1);
        else ctx.fillRect(x1, y1 - t / 2, x2 - x1, t);
      }
    }
    this.strokeLead(lead, leadW);

    // edge markers (gemini / delta / inequality / difference), like small solder tags on the leading
    for (const clue of p.clues) {
      if (clue.type !== 'gemini' && clue.type !== 'delta' && clue.type !== 'inequality' && clue.type !== 'difference') continue;
      const e = edgeBetween(g, clue.edge.a, clue.edge.b);
      const [x1, y1, x2, y2] = this.edgeSegment(e);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const r = s * 0.17;
      ctx.fillStyle = '#fbf7ef';
      ctx.strokeStyle = LEAD;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (clue.type === 'difference') {
        ctx.fillStyle = INK;
        ctx.font = `700 ${Math.round(r * 1.45)}px ${CLUE_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(clue.value), mx, my + r * 0.08);
        continue;
      }
      // The glyph is drawn as strokes, not text: a font's "=" sits on its math
      // axis, which lands above the circle's centre and differs per platform.
      ctx.lineWidth = Math.max(1.2, r * 0.22);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const half = r * 0.5;
      if (clue.type === 'inequality') {
        // a chevron whose open side faces the larger region: the marked edge is
        // vertical (cells left/right) or horizontal (cells above/below)
        const larger = clue.larger === 'a' ? clue.edge.a : clue.edge.b;
        const vertical = x1 === x2;
        const toward = vertical ? (larger % g.w < (larger === clue.edge.a ? clue.edge.b : clue.edge.a) % g.w ? -1 : 1) : larger < (larger === clue.edge.a ? clue.edge.b : clue.edge.a) ? -1 : 1;
        // the point of the chevron lies on the smaller side
        const tip = half * 0.9;
        if (vertical) {
          ctx.moveTo(mx + toward * tip, my - half);
          ctx.lineTo(mx - toward * tip * 0.55, my);
          ctx.lineTo(mx + toward * tip, my + half);
        } else {
          ctx.moveTo(mx - half, my + toward * tip);
          ctx.lineTo(mx, my - toward * tip * 0.55);
          ctx.lineTo(mx + half, my + toward * tip);
        }
        ctx.stroke();
        continue;
      }
      const gap = r * 0.26;
      ctx.moveTo(mx - half, my - gap);
      ctx.lineTo(mx + half, my - gap);
      ctx.moveTo(mx - half, my + gap);
      ctx.lineTo(mx + half, my + gap);
      if (clue.type === 'delta') {
        ctx.moveTo(mx + r * 0.32, my - r * 0.62);
        ctx.lineTo(mx - r * 0.32, my + r * 0.62);
      }
      ctx.stroke();
    }

    // watchtowers: a small dark tower on the vertex with the number of regions it sees
    for (const clue of p.clues) {
      if (clue.type !== 'watchtower') continue;
      const cx = pad + clue.x * s;
      const cy = pad + clue.y * s;
      const r = s * 0.16;
      ctx.fillStyle = '#2b2733';
      ctx.strokeStyle = '#fbf7ef';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fbf7ef';
      ctx.font = `700 ${Math.round(r * 1.5)}px ${CLUE_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(clue.count), cx, cy + r * 0.08);
    }

    // area counter
    if (this.areaCells && this.areaCells.length) {
      let sx = 0;
      let sy = 0;
      for (const c of this.areaCells) {
        sx += (c % g.w) + 0.5;
        sy += Math.floor(c / g.w) + 0.5;
      }
      const cx = pad + (sx / this.areaCells.length) * s;
      const cy = pad + (sy / this.areaCells.length) * s;
      ctx.fillStyle = 'rgba(28,28,33,0.88)';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbf7ef';
      ctx.font = `bold ${Math.round(s * 0.45)}px sans-serif`;
      ctx.fillText(String(this.areaCells.length), cx, cy + 1);
    }
  }

  /** Lead came: a dark bar with a thin light catching its upper-left edge. */
  private strokeLead(segs: [number, number, number, number][], w: number): void {
    const ctx = this.ctx;
    ctx.lineCap = 'square';
    ctx.strokeStyle = LEAD;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.strokeStyle = LEAD_LIGHT;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    const o = w / 2 - 1.4;
    for (const [x1, y1, x2, y2] of segs) {
      if (x1 === x2) {
        ctx.moveTo(x1 - o, y1 + 1);
        ctx.lineTo(x2 - o, y2 - 1);
      } else {
        ctx.moveTo(x1 + 1, y1 - o);
        ctx.lineTo(x2 - 1, y2 - o);
      }
    }
    ctx.stroke();
    ctx.lineCap = 'round';
  }

  private text(t: string, cell: number, font: string): void {
    const g = this.grid!;
    const x = cell % g.w;
    const y = (cell - x) / g.w;
    const ctx = this.ctx;
    const px = this.pad + (x + 0.5) * this.cell;
    const py = this.pad + (y + 0.5) * this.cell + 1;
    ctx.font = font;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeText(t, px, py);
    ctx.fillStyle = INK;
    ctx.fillText(t, px, py);
  }

  /** Palisade tile: a small square whose sides are drawn thick where the cell's sides are borders. */
  private palisadeTile(sides: number, cell: number): void {
    const g = this.grid!;
    const x = cell % g.w;
    const y = (cell - x) / g.w;
    const ctx = this.ctx;
    const half = this.cell * 0.22;
    const cx = this.pad + (x + 0.5) * this.cell;
    const cy = this.pad + (y + 0.5) * this.cell;
    ctx.lineCap = 'square';
    ctx.strokeStyle = 'rgba(23,22,26,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, this.cell * 0.07);
    ctx.beginPath();
    const corners: [number, number][] = [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]];
    for (let dir = 0; dir < 4; dir++) {
      if (!((sides >> dir) & 1)) continue;
      const [ax, ay] = corners[dir];
      const [bx, by] = corners[(dir + 1) % 4];
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.lineCap = 'round';
  }

  private miniShape(key: ShapeKey, cell: number): void {
    const g = this.grid!;
    const x = cell % g.w;
    const y = (cell - x) / g.w;
    const pts = parseKey(key);
    let w = 0;
    let h = 0;
    for (const [px, py] of pts) {
      w = Math.max(w, px + 1);
      h = Math.max(h, py + 1);
    }
    const unit = (this.cell * 0.62) / Math.max(w, h);
    const ox = this.pad + (x + 0.5) * this.cell - (w * unit) / 2;
    const oy = this.pad + (y + 0.5) * this.cell - (h * unit) / 2;
    this.ctx.fillStyle = INK;
    for (const [px, py] of pts) this.ctx.fillRect(ox + px * unit + 0.5, oy + py * unit + 0.5, unit - 1, unit - 1);
  }
}

/** Hatching used to mark rule violations: dark red with a light stripe so it reads on any glass. */
function makeHatch(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const size = 8;
  c.width = size * dpr;
  c.height = size * dpr;
  const p = c.getContext('2d')!;
  p.scale(dpr, dpr);
  const line = (offset: number, style: string, width: number) => {
    p.strokeStyle = style;
    p.lineWidth = width;
    p.beginPath();
    p.moveTo(-2 + offset, size + 2 + offset);
    p.lineTo(size + 2 + offset, -2 + offset);
    p.moveTo(-2 + offset, 2 + offset);
    p.lineTo(2 + offset, -2 + offset);
    p.moveTo(size - 2 + offset, size + 2 + offset);
    p.lineTo(size + 2 + offset, size - 2 + offset);
    p.stroke();
  };
  line(0, 'rgba(110,20,20,0.75)', 2.2);
  line(1.6, 'rgba(255,255,255,0.55)', 0.8);
  const pat = ctx.createPattern(c, 'repeat');
  if (pat && 'setTransform' in pat) pat.setTransform(new DOMMatrix().scale(1 / dpr));
  return pat;
}

/** The grain of hand-rolled glass: faint diagonal streaks and a little mottling. */
function makeGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const size = 160;
  c.width = size * dpr;
  c.height = size * dpr;
  const p = c.getContext('2d')!;
  p.scale(dpr, dpr);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  p.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const x = rnd() * size * 2 - size;
    const len = 40 + rnd() * 100;
    const light = rnd() < 0.6;
    p.strokeStyle = light ? `rgba(255,255,255,${0.03 + rnd() * 0.05})` : `rgba(0,0,30,${0.02 + rnd() * 0.03})`;
    p.lineWidth = 3 + rnd() * 9;
    p.beginPath();
    // streaks are tiled: draw each one three times so the pattern wraps
    for (const dx of [-size, 0, size]) {
      p.moveTo(x + dx, size);
      p.lineTo(x + dx + len, size - len);
    }
    p.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const light = rnd() < 0.65;
    p.fillStyle = light ? `rgba(255,255,255,${0.02 + rnd() * 0.04})` : `rgba(0,0,30,${0.015 + rnd() * 0.025})`;
    const x = rnd() * size;
    const y = rnd() * size;
    const rr = 6 + rnd() * 18;
    // mottling is tiled too: draw near the edges again so the pattern wraps
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      p.beginPath();
      p.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
      p.fill();
    }
  }
  const pat = ctx.createPattern(c, 'repeat');
  if (pat && 'setTransform' in pat) pat.setTransform(new DOMMatrix().scale(1 / dpr));
  return pat;
}

function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** Linear blend of two hex colours (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

/** A richer version of a glass colour: more saturated and a touch darker. */
function deepen(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  let h = 0;
  const d = (max - min) / 255;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / 255 / d) % 6;
    else if (max === g) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
  }
  const s2 = Math.min(1, sat * 1.25 + 0.1);
  const l2 = Math.max(0, l - 0.08);
  const c = (1 - Math.abs(2 * l2 - 1)) * s2;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l2 - c / 2;
  const [r2, g2, b2] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r2)}${to(g2)}${to(b2)}`;
}

/** Wall edges of a label array. */
export function wallsOf(g: Grid, labels: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(g.edges);
  for (let e = 0; e < g.edges; e++) out[e] = labels[g.edgeA[e]] !== labels[g.edgeB[e]] ? 1 : 0;
  return out;
}

/**
 * A solution as the player would have marked it: every region painted (with
 * neighbouring regions in different hues) and its borders drawn.
 */
export function solutionView(puzzle: Puzzle, labels: ArrayLike<number>): PlayerState {
  const ps = new PlayerState(puzzle);
  const g = ps.grid;
  const hue: number[] = [];
  for (let c = 0; c < g.cells; c++) {
    const l = labels[c];
    if (l < 0) continue;
    if (hue[l] === undefined) {
      // greedy colouring: avoid hues already given to any neighbouring region
      const used = new Set<number>();
      for (let d = 0; d < g.cells; d++) {
        if (labels[d] !== l) continue;
        for (const n of g.adj[d]) if (labels[n] !== l && labels[n] >= 0 && hue[labels[n]] !== undefined) used.add(hue[labels[n]]);
      }
      const pool = huePool(used);
      hue[l] = pool.length ? pool[l % pool.length] : l % HUES.length;
    }
    ps.paint[c] = l + 1;
    ps.hue[l + 1] = hue[l];
  }
  for (let e = 0; e < g.edges; e++) if (labels[g.edgeA[e]] !== labels[g.edgeB[e]]) ps.setEdge(e, WALL);
  return ps;
}

/** Small canvas drawing a shape, for the rules panel. */
export function shapeIcon(key: ShapeKey, unit = 9, fill = '#374151'): HTMLCanvasElement {
  const pts = parseKey(key);
  let w = 0;
  let h = 0;
  for (const [x, y] of pts) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  c.width = (w * unit + 6) * dpr;
  c.height = (h * unit + 6) * dpr;
  c.style.width = `${w * unit + 6}px`;
  c.style.height = `${h * unit + 6}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = fill;
  for (const [x, y] of pts) ctx.fillRect(3 + x * unit + 0.5, 3 + y * unit + 0.5, unit - 1, unit - 1);
  return c;
}

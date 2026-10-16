/** Rendering limits for high-density mobile screens and completion effects. */
export const MAX_BOARD_DPR = 2;
export const COMPLETION_SHINE_MS = 2800;
export const COMPLETION_FRAME_MS = 33;

/** Limit backing pixels without changing the logical board or touch coordinates. */
export function boardDevicePixelRatio(deviceDpr: number): number {
  return Number.isFinite(deviceDpr) && deviceDpr > 0
    ? Math.min(deviceDpr, MAX_BOARD_DPR)
    : 1;
}

/** The completed board should become completely idle after its short celebration. */
export function completionAnimationActive(
  now: number,
  rampStart: number,
  rampDuration: number,
  shineStart: number,
  complete: boolean,
  reducedMotion: boolean,
  revealing: boolean,
): boolean {
  return now < rampStart + rampDuration || (
    complete && !reducedMotion && !revealing &&
    now >= shineStart && now < shineStart + COMPLETION_SHINE_MS
  );
}

/**
 * The board occupies a touch-only viewport, but its overlay controls are real
 * buttons. Cancelling touchstart/touchend on a button suppresses the browser's
 * synthetic click on Android WebView and mobile Chrome.
 *
 * Keep touch cancellation for drawing/pinching and empty viewport space, but
 * never cancel touches that start on an interactive viewport control.
 */
export function isBoardViewportControl(target: EventTarget | null): boolean {
  return Boolean((target as Element | null)?.closest?.(
    'button, a, input, select, textarea, [role="button"]',
  ));
}

export function preventBoardTouchDefault(event: Pick<TouchEvent, 'target' | 'preventDefault'>): void {
  if (!isBoardViewportControl(event.target)) event.preventDefault();
}

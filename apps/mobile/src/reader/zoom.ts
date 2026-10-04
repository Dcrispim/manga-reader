// Pure helpers behind ZoomableList; the gesture callbacks (worklets) only call these.

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;

export function clampScale(scale: number): number {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Horizontal pan limit: content scaled around its centre overflows by (scale-1)/2 per side. */
export function clampTranslateX(x: number, scale: number, width: number): number {
  'worklet';
  const limit = ((scale - 1) * width) / 2;
  return Math.min(limit, Math.max(-limit, x));
}

/** Double tap zooms in from rest and back out when already zoomed. */
export function doubleTapScale(current: number): number {
  'worklet';
  return current > 1.05 ? MIN_SCALE : DOUBLE_TAP_SCALE;
}

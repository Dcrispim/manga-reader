import { DOUBLE_TAP_SCALE, MAX_SCALE, clampScale, clampTranslateX, doubleTapScale } from '../zoom';

describe('zoom helpers', () => {
  it('clamps the pinch scale between 1 and the maximum', () => {
    expect(clampScale(0.3)).toBe(1);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(99)).toBe(MAX_SCALE);
  });

  it('limits horizontal pan to the overflow of the scaled content', () => {
    expect(clampTranslateX(500, 2, 400)).toBe(200);
    expect(clampTranslateX(-500, 2, 400)).toBe(-200);
    expect(clampTranslateX(50, 1, 400)).toBe(0);
  });

  it('double tap toggles between rest and zoomed', () => {
    expect(doubleTapScale(1)).toBe(DOUBLE_TAP_SCALE);
    expect(doubleTapScale(DOUBLE_TAP_SCALE)).toBe(1);
  });
});

import { DEFAULT_OVERLAY_LAYER } from './overlay-layer';
import { overlayViewportInsets, reserveOverlayViewportSpace } from './overlay-viewport-inset';

describe('overlay viewport inset', () => {
  it('reserves an edge until the reservation is released', () => {
    const release = reserveOverlayViewportSpace({ bottom: 360 });

    expect(overlayViewportInsets()).toEqual({ top: 0, right: 0, bottom: 360, left: 0 });

    release();

    expect(overlayViewportInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('keeps the largest reservation per edge', () => {
    const releaseSmall = reserveOverlayViewportSpace({ bottom: 120, left: 80 });
    const releaseLarge = reserveOverlayViewportSpace({ bottom: 360 });

    expect(overlayViewportInsets()).toEqual({ top: 0, right: 0, bottom: 360, left: 80 });

    releaseLarge();

    expect(overlayViewportInsets()).toEqual({ top: 0, right: 0, bottom: 120, left: 80 });

    releaseSmall();
  });

  it('ignores a reservation made at or below the level asking for it', () => {
    const release = reserveOverlayViewportSpace({ bottom: 360, layer: DEFAULT_OVERLAY_LAYER + 10 });

    expect(overlayViewportInsets(DEFAULT_OVERLAY_LAYER).bottom).toBe(360);
    expect(overlayViewportInsets(DEFAULT_OVERLAY_LAYER + 10).bottom).toBe(0);
    expect(overlayViewportInsets(DEFAULT_OVERLAY_LAYER + 20).bottom).toBe(0);

    release();
  });
});

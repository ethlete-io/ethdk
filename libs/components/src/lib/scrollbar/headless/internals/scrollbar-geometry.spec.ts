import { measureScrollbar, readScrollDistance, readScrollMetrics, scrollToDistance } from './scrollbar-geometry';

type FakeTarget = {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scroll: (options: ScrollToOptions) => void;
};

const createTarget = (overrides: Partial<FakeTarget> = {}) => {
  const calls: ScrollToOptions[] = [];

  const target: FakeTarget = {
    clientWidth: 200,
    clientHeight: 100,
    scrollWidth: 200,
    scrollHeight: 400,
    scrollLeft: 0,
    scrollTop: 0,
    scroll: (options) => calls.push(options),
    ...overrides,
  };

  return { target: target as unknown as HTMLElement, calls };
};

describe('readScrollMetrics', () => {
  it('reports the overflow of the requested axis only', () => {
    const { target } = createTarget();

    expect(readScrollMetrics(target, 'vertical')).toEqual({ viewportSize: 100, contentSize: 400, maxScroll: 300 });
    expect(readScrollMetrics(target, 'horizontal')).toEqual({ viewportSize: 200, contentSize: 200, maxScroll: 0 });
  });

  it('never reports a negative maxScroll', () => {
    const { target } = createTarget({ clientHeight: 400, scrollHeight: 100 });

    expect(readScrollMetrics(target, 'vertical').maxScroll).toBe(0);
  });
});

describe('readScrollDistance', () => {
  it('reads scrollTop for a vertical scrollbar', () => {
    const { target } = createTarget({ scrollTop: 120 });

    expect(readScrollDistance(target, 'vertical')).toBe(120);
  });

  it('reads a right-to-left scrollLeft as a distance from the start edge', () => {
    const { target } = createTarget({ scrollLeft: -240 });

    expect(readScrollDistance(target, 'horizontal')).toBe(240);
  });
});

describe('scrollToDistance', () => {
  it('writes a positive offset in a left-to-right container', () => {
    const { target, calls } = createTarget();

    scrollToDistance({ target, orientation: 'horizontal', distance: 80, isRtl: false, behavior: 'instant' });

    expect(calls).toEqual([{ left: 80, behavior: 'instant' }]);
  });

  it('writes a negative offset in a right-to-left container', () => {
    const { target, calls } = createTarget();

    scrollToDistance({ target, orientation: 'horizontal', distance: 80, isRtl: true, behavior: 'instant' });

    expect(calls).toEqual([{ left: -80, behavior: 'instant' }]);
  });

  it('ignores the direction on the block axis', () => {
    const { target, calls } = createTarget();

    scrollToDistance({ target, orientation: 'vertical', distance: 80, isRtl: true, behavior: 'smooth' });

    expect(calls).toEqual([{ top: 80, behavior: 'smooth' }]);
  });
});

describe('measureScrollbar', () => {
  it('sizes the thumb by the share of the content that is in view', () => {
    const { target } = createTarget();

    const geometry = measureScrollbar({ target, orientation: 'vertical', trackSize: 100, minThumbSize: 24 });

    expect(geometry).toEqual({ canScroll: true, thumbSize: 25, thumbOffset: 0, progress: 0 });
  });

  it('moves the thumb to the end of the track at the end of the content', () => {
    const { target } = createTarget({ scrollTop: 300 });

    const geometry = measureScrollbar({ target, orientation: 'vertical', trackSize: 100, minThumbSize: 24 });

    expect(geometry.progress).toBe(1);
    expect(geometry.thumbOffset).toBe(75);
  });

  it('keeps the thumb at minThumbSize on a long track', () => {
    const { target } = createTarget({ scrollHeight: 10000 });

    const geometry = measureScrollbar({ target, orientation: 'vertical', trackSize: 100, minThumbSize: 24 });

    expect(geometry.thumbSize).toBe(24);
  });

  it('never sizes the thumb past the track', () => {
    const { target } = createTarget({ scrollHeight: 110 });

    const geometry = measureScrollbar({ target, orientation: 'vertical', trackSize: 20, minThumbSize: 24 });

    expect(geometry.thumbSize).toBe(20);
  });

  it('reports no scrolling when the content fits', () => {
    const { target } = createTarget({ scrollHeight: 100 });

    expect(measureScrollbar({ target, orientation: 'vertical', trackSize: 100, minThumbSize: 24 }).canScroll).toBe(
      false,
    );
  });

  it('reports no scrolling before the track has been laid out', () => {
    const { target } = createTarget();

    expect(measureScrollbar({ target, orientation: 'vertical', trackSize: 0, minThumbSize: 24 }).canScroll).toBe(false);
  });

  it('offsets a right-to-left thumb from the start edge', () => {
    const { target } = createTarget({ scrollWidth: 400, scrollLeft: -100 });

    const geometry = measureScrollbar({ target, orientation: 'horizontal', trackSize: 200, minThumbSize: 24 });

    expect(geometry.progress).toBe(0.5);
    expect(geometry.thumbOffset).toBe(50);
  });
});

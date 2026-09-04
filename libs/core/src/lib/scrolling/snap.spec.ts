import { getScrollContainerTarget, getScrollItemTarget, getScrollSnapTarget } from './snap';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  top,
  width,
  x: left,
  y: top,
  toJSON: () => ({}),
});

const elementAt = (left: number, top: number, width: number, height: number) => {
  const element = document.createElement('div');
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(left, top, width, height));

  return element;
};

const entry = (target: HTMLElement, intersectionRatio: number): IntersectionObserverEntry => {
  const targetRect = target.getBoundingClientRect();

  return {
    boundingClientRect: targetRect,
    intersectionRatio,
    intersectionRect: targetRect,
    isIntersecting: intersectionRatio > 0,
    rootBounds: null,
    target,
    time: 0,
  };
};

describe('getScrollSnapTarget', () => {
  it('returns no target when there are no items or the nearest item is already aligned', () => {
    const container = elementAt(0, 0, 100, 100);
    const aligned = elementAt(0.5, 0, 20, 20);

    expect(getScrollSnapTarget([], container, 'horizontal', 'start')).toBeNull();
    expect(getScrollSnapTarget([aligned], container, 'horizontal', 'start')).toBeNull();
  });

  it('selects the closest item and origin in auto mode', () => {
    const container = elementAt(0, 0, 100, 100);
    const nearStart = elementAt(12, 0, 20, 20);
    const nearEnd = elementAt(88, 0, 20, 20);

    expect(getScrollSnapTarget([nearStart, nearEnd], container, 'horizontal', 'auto')).toEqual({
      element: nearEnd,
      origin: 'end',
    });
  });

  it('uses the requested vertical origin and margin', () => {
    const container = elementAt(0, 20, 100, 100);
    const item = elementAt(0, 100, 20, 30);

    expect(getScrollSnapTarget([item], container, 'vertical', 'end', 5)).toEqual({
      element: item,
      origin: 'end',
    });
  });

  it('aligns the visible edge of an oversized item', () => {
    const container = elementAt(0, 0, 100, 100);
    const startVisible = elementAt(10, 0, 150, 20);
    const endVisible = elementAt(-60, 0, 150, 20);
    const coversContainer = elementAt(-20, 0, 150, 20);

    expect(getScrollSnapTarget([startVisible], container, 'horizontal', 'center')).toEqual({
      element: startVisible,
      origin: 'start',
    });
    expect(getScrollSnapTarget([endVisible], container, 'horizontal', 'center')).toEqual({
      element: endVisible,
      origin: 'end',
    });
    expect(getScrollSnapTarget([coversContainer], container, 'horizontal', 'center')).toBeNull();
  });
});

describe('getScrollContainerTarget', () => {
  it('uses the first partially visible entry when scrolling toward the start', () => {
    const elements = Array.from({ length: 4 }, () => document.createElement('div'));
    const entries = elements.map((element, index) => entry(element, [0, 0.5, 1, 0][index] ?? 0));

    expect(getScrollContainerTarget(entries, 'start')).toEqual({ element: elements[1], origin: 'end' });
  });

  it('advances beyond a fully visible entry when scrolling toward the end', () => {
    const elements = Array.from({ length: 4 }, () => document.createElement('div'));
    const entries = elements.map((element, index) => entry(element, [0, 0.5, 1, 0][index] ?? 0));

    expect(getScrollContainerTarget(entries, 'end')).toEqual({ element: elements[3], origin: 'start' });
  });

  it('returns no target when nothing is visible', () => {
    const element = document.createElement('div');

    expect(getScrollContainerTarget([entry(element, 0)], 'start')).toBeNull();
  });
});

describe('getScrollItemTarget', () => {
  it('returns no target when nothing is visible', () => {
    const container = elementAt(0, 0, 100, 100);
    const item = elementAt(0, 0, 20, 20);

    expect(getScrollItemTarget([entry(item, 0)], container, 'start', 'auto', 'horizontal')).toBeNull();
  });

  it('moves between oversized items when the relevant edge is visible', () => {
    const container = elementAt(0, 0, 100, 100);
    const previous = elementAt(-20, 0, 50, 20);
    const current = elementAt(0, 0, 160, 20);
    const next = elementAt(160, 0, 50, 20);
    const entries = [entry(previous, 0), entry(current, 0.6), entry(next, 0)];

    expect(getScrollItemTarget(entries, container, 'start', 'auto', 'horizontal')).toEqual({
      element: previous,
      index: 0,
      origin: 'end',
    });

    vi.mocked(current.getBoundingClientRect).mockReturnValue(rect(-60, 0, 160, 20));

    expect(getScrollItemTarget(entries, container, 'end', 'auto', 'horizontal')).toEqual({
      element: next,
      index: 2,
      origin: 'start',
    });
  });

  it('keeps moving through an oversized item while its destination edge is clipped', () => {
    const container = elementAt(0, 0, 100, 100);
    const item = elementAt(-40, 0, 160, 20);
    const entries = [entry(item, 0.6)];

    expect(getScrollItemTarget(entries, container, 'start', 'auto', 'horizontal')).toEqual({
      element: item,
      index: 0,
      origin: 'start',
    });
    expect(getScrollItemTarget(entries, container, 'end', 'auto', 'horizontal')).toEqual({
      element: item,
      index: 0,
      origin: 'end',
    });
  });

  it('uses center alignment for the leading or trailing visible item', () => {
    const container = elementAt(0, 0, 100, 100);
    const first = elementAt(-10, 0, 40, 20);
    const second = elementAt(30, 0, 40, 20);
    const entries = [entry(first, 0.75), entry(second, 1)];

    expect(getScrollItemTarget(entries, container, 'start', 'center', 'horizontal')).toEqual({
      element: first,
      index: 0,
      origin: 'center',
    });
    expect(getScrollItemTarget(entries, container, 'end', 'center', 'horizontal')).toEqual({
      element: second,
      index: 1,
      origin: 'center',
    });
  });

  it('advances from a fully visible item and stays on a partially visible item', () => {
    const container = elementAt(0, 0, 100, 100);
    const first = elementAt(0, 0, 30, 20);
    const second = elementAt(30, 0, 50, 20);
    const third = elementAt(80, 0, 30, 20);
    const entries = [entry(first, 1), entry(second, 1), entry(third, 0.4)];

    expect(getScrollItemTarget(entries, container, 'start', 'auto', 'horizontal')).toBeNull();
    expect(getScrollItemTarget(entries, container, 'end', 'auto', 'horizontal')).toEqual({
      element: third,
      index: 2,
      origin: 'end',
    });
  });
});

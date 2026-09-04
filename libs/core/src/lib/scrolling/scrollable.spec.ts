import { elementCanScroll, getElementScrollCoordinates, isElementVisible, scrollToElement } from './scrollable';

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

const elementWithLayout = ({
  clientHeight,
  clientWidth,
  height = clientHeight,
  left = 0,
  scrollHeight,
  scrollLeft = 0,
  scrollTop = 0,
  scrollWidth,
  top = 0,
  width = clientWidth,
}: {
  clientHeight: number;
  clientWidth: number;
  height?: number;
  left?: number;
  scrollHeight: number;
  scrollLeft?: number;
  scrollTop?: number;
  scrollWidth: number;
  top?: number;
  width?: number;
}) => {
  const element = document.createElement('div');

  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    clientWidth: { configurable: true, value: clientWidth },
    scrollHeight: { configurable: true, value: scrollHeight },
    scrollLeft: { configurable: true, value: scrollLeft },
    scrollTop: { configurable: true, value: scrollTop },
    scrollWidth: { configurable: true, value: scrollWidth },
  });
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(left, top, width, height));

  return element;
};

describe('elementCanScroll', () => {
  it('checks each axis independently', () => {
    const horizontal = elementWithLayout({ clientHeight: 100, clientWidth: 100, scrollHeight: 100, scrollWidth: 200 });
    const vertical = elementWithLayout({ clientHeight: 100, clientWidth: 100, scrollHeight: 200, scrollWidth: 100 });

    expect(elementCanScroll(horizontal)).toBe(true);
    expect(elementCanScroll(horizontal, 'x')).toBe(true);
    expect(elementCanScroll(horizontal, 'y')).toBe(false);
    expect(elementCanScroll(vertical, 'x')).toBe(false);
    expect(elementCanScroll(vertical, 'y')).toBe(true);
  });

  it('returns false for a non-scrollable or absent element', () => {
    const element = elementWithLayout({ clientHeight: 100, clientWidth: 100, scrollHeight: 100, scrollWidth: 100 });

    expect(elementCanScroll(element)).toBe(false);
    expect(elementCanScroll(null, 'x')).toBe(false);
  });
});

describe('isElementVisible', () => {
  it('returns no result without an element', () => {
    expect(isElementVisible({ element: null })).toBeNull();
  });

  it('reports a fully visible element', () => {
    const container = document.createElement('div');
    const element = document.createElement('div');
    const containerRect = rect(10, 20, 100, 80);
    const elementRect = rect(30, 40, 20, 10);

    expect(isElementVisible({ container, containerRect, element, elementRect })).toMatchObject({
      block: true,
      blockIntersection: 1,
      inline: true,
      inlineIntersection: 1,
      intersectionRatio: 1,
      isIntersecting: true,
    });
  });

  it('calculates partial intersection on both axes', () => {
    const container = document.createElement('div');
    const element = document.createElement('div');
    const containerRect = rect(0, 0, 100, 100);
    const elementRect = rect(80, 75, 40, 50);

    expect(isElementVisible({ container, containerRect, element, elementRect })).toMatchObject({
      block: false,
      blockIntersection: 0.5,
      inline: false,
      inlineIntersection: 0.5,
      intersectionRatio: 0.5,
      isIntersecting: true,
    });
  });

  it('clamps a non-intersecting element to zero', () => {
    const container = document.createElement('div');
    const element = document.createElement('div');

    expect(
      isElementVisible({
        container,
        containerRect: rect(0, 0, 100, 100),
        element,
        elementRect: rect(120, 120, 20, 20),
      }),
    ).toMatchObject({
      blockIntersection: 0,
      inlineIntersection: 0,
      intersectionRatio: 0,
      isIntersecting: false,
    });
  });
});

describe('getElementScrollCoordinates', () => {
  const createPair = () => ({
    container: elementWithLayout({
      clientHeight: 100,
      clientWidth: 200,
      height: 100,
      left: 20,
      scrollHeight: 500,
      scrollLeft: 30,
      scrollTop: 40,
      scrollWidth: 600,
      top: 10,
      width: 200,
    }),
    element: elementWithLayout({
      clientHeight: 40,
      clientWidth: 60,
      height: 40,
      left: 270,
      scrollHeight: 40,
      scrollWidth: 60,
      top: 160,
      width: 60,
    }),
  });

  it('returns empty coordinates when scrolling is unavailable', () => {
    const element = document.createElement('div');

    expect(getElementScrollCoordinates({ element })).toEqual({
      behavior: 'smooth',
      left: undefined,
      top: undefined,
    });
  });

  it.each([
    ['start', 275, 183],
    ['center', 210, 160],
    ['end', 145, 137],
  ] as const)('aligns the element to the %s origin', (origin, left, top) => {
    const { container, element } = createPair();

    expect(
      getElementScrollCoordinates({
        behavior: 'auto',
        container,
        element,
        origin,
        scrollBlockMargin: 7,
        scrollInlineMargin: 5,
      }),
    ).toEqual({ behavior: 'auto', left, top });
  });

  it('leaves an already visible element at the current nearest coordinates', () => {
    const container = elementWithLayout({
      clientHeight: 100,
      clientWidth: 200,
      scrollHeight: 500,
      scrollLeft: 30,
      scrollTop: 40,
      scrollWidth: 600,
    });
    const element = elementWithLayout({
      clientHeight: 20,
      clientWidth: 20,
      left: 50,
      scrollHeight: 20,
      scrollWidth: 20,
      top: 50,
    });

    expect(getElementScrollCoordinates({ container, element })).toEqual({ behavior: 'smooth', left: 30, top: 40 });
  });

  it('uses the nearest clipped edge and respects the requested direction', () => {
    const { container, element } = createPair();

    expect(getElementScrollCoordinates({ container, direction: 'block', element, origin: 'nearest' })).toEqual({
      behavior: 'smooth',
      left: undefined,
      top: 130,
    });
  });
});

describe('scrollToElement', () => {
  it('scrolls the container with the calculated coordinates', () => {
    const container = elementWithLayout({
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 200,
      scrollWidth: 200,
    });
    const element = elementWithLayout({
      clientHeight: 20,
      clientWidth: 20,
      left: 120,
      scrollHeight: 20,
      scrollWidth: 20,
      top: 130,
    });
    const scrollTo = vi.fn();
    container.scrollTo = scrollTo;

    scrollToElement({ behavior: 'auto', container, element, origin: 'start' });

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', left: 120, top: 130 });
  });
});

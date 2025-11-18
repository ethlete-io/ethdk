import { clamp } from './clamp.util';

/**
 * Checks if an element or the viewport can scroll in a given direction.
 * @param element The element to check. If null/undefined, checks if the viewport can scroll.
 * @param direction The direction to check. If not provided, checks both directions.
 * @returns true if the element or viewport can scroll in the given direction.
 */
export const elementCanScroll = (element?: HTMLElement | null, direction?: 'x' | 'y') => {
  const el = element || document.documentElement;
  const { scrollHeight, clientHeight, scrollWidth, clientWidth } = el;

  if (direction === 'x') {
    return scrollWidth > clientWidth;
  } else if (direction === 'y') {
    return scrollHeight > clientHeight;
  }

  return scrollHeight > clientHeight || scrollWidth > clientWidth;
};

const createViewportRect = (): DOMRect =>
  ({
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect;

export interface IsElementVisibleOptions {
  /**
   * The element to check if it is visible inside a container.
   */
  element?: HTMLElement | null;

  /**
   * The container to check if the element is visible inside.
   * If null or undefined, uses the viewport as the container.
   * @default null (viewport)
   */
  container?: HTMLElement | null;

  /**
   * The container's rect to check if the element is visible inside. Can be supplied to reduce the amount of DOM reads.
   * Only used when container is provided and not null.
   * @default container.getBoundingClientRect()
   */
  containerRect?: DOMRect | null;

  /**
   * The element's rect. Can be supplied to reduce the amount of DOM reads.
   * @default element.getBoundingClientRect()
   */
  elementRect?: DOMRect | null;
}

export interface CurrentElementVisibility {
  /**
   * Whether the element is visible in the inline direction.
   */
  inline: boolean;

  /**
   * Whether the element is visible in the block direction.
   */
  block: boolean;

  /**
   * The percentage of the element that is visible in the inline direction.
   */
  inlineIntersection: number;

  /**
   * The percentage of the element that is visible in the block direction.
   */
  blockIntersection: number;

  /**
   * Whether the element is intersecting the container.
   */
  isIntersecting: boolean;

  /**
   * The ratio of the element that is intersecting the container.
   */
  intersectionRatio: number;

  /**
   * The element that is being checked for visibility.
   */
  element: HTMLElement;

  /**
   * The container's rect used for the calculation.
   */
  containerRect: DOMRect;

  /**
   * The element's rect used for the calculation.
   */
  elementRect: DOMRect;
}

export const isElementVisible = (options: IsElementVisibleOptions): CurrentElementVisibility | null => {
  const { container, element } = options;

  if (!element) {
    return null;
  }

  const elementRect = options.elementRect || element.getBoundingClientRect();
  const containerRect = container ? options.containerRect || container.getBoundingClientRect() : createViewportRect();

  const canScroll = elementCanScroll(container);

  if (!canScroll) {
    return {
      inline: true,
      block: true,
      blockIntersection: 1,
      inlineIntersection: 1,
      intersectionRatio: 1,
      isIntersecting: true,
      element,
      containerRect,
      elementRect,
    };
  }

  const elLeft = elementRect.left;
  const elTop = elementRect.top;
  const elWidth = elementRect.width || 1;
  const elHeight = elementRect.height || 1;
  const elRight = elLeft + elWidth;
  const elBottom = elTop + elHeight;

  const conLeft = containerRect.left;
  const conTop = containerRect.top;
  const conRight = conLeft + containerRect.width;
  const conBottom = conTop + containerRect.height;

  const isElementInlineVisible = elLeft >= conLeft && elRight <= conRight;
  const isElementBlockVisible = elTop >= conTop && elBottom <= conBottom;

  const inlineIntersection = Math.min(elRight, conRight) - Math.max(elLeft, conLeft);
  const blockIntersection = Math.min(elBottom, conBottom) - Math.max(elTop, conTop);

  const inlineIntersectionPercentage = clamp(inlineIntersection / elWidth, 0, 1);
  const blockIntersectionPercentage = clamp(blockIntersection / elHeight, 0, 1);

  return {
    inline: isElementInlineVisible,
    block: isElementBlockVisible,
    inlineIntersection: inlineIntersectionPercentage,
    blockIntersection: blockIntersectionPercentage,
    isIntersecting: isElementInlineVisible && isElementBlockVisible,
    element,
    containerRect,
    elementRect,

    // Round the intersection ratio to the nearest 0.01 to avoid floating point errors and system scaling issues.
    intersectionRatio: Math.round(Math.min(inlineIntersectionPercentage, blockIntersectionPercentage) * 100) / 100,
  };
};

export const getElementScrollCoordinates = (options: ScrollToElementOptions): ScrollToOptions => {
  const {
    container,
    element,
    direction,
    behavior = 'smooth',
    origin = 'nearest',
    scrollBlockMargin = 0,
    scrollInlineMargin = 0,
  } = options;

  if (!element || !container || !elementCanScroll(container)) {
    return {
      behavior,
      left: undefined,
      top: undefined,
    };
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const { scrollLeft, scrollTop } = container;
  const elWidth = elementRect.width;
  const elHeight = elementRect.height;
  const elLeft = elementRect.left;
  const elTop = elementRect.top;
  const elRight = elementRect.right;
  const elBottom = elementRect.bottom;

  const conWidth = containerRect.width;
  const conHeight = containerRect.height;
  const conLeft = containerRect.left;
  const conTop = containerRect.top;
  const conRight = containerRect.right;
  const conBottom = containerRect.bottom;

  const shouldScrollLeft = direction === 'inline' || direction === 'both' || !direction;
  const shouldScrollTop = direction === 'block' || direction === 'both' || !direction;

  let scrollLeftTo = scrollLeft;
  let scrollTopTo = scrollTop;

  const relativeTop = elTop - conTop;
  const relativeLeft = elLeft - conLeft;

  const calculateScrollToStart = () => {
    scrollLeftTo = scrollLeft + relativeLeft - scrollInlineMargin;
    scrollTopTo = scrollTop + relativeTop - scrollBlockMargin;
  };

  const calculateScrollToEnd = () => {
    scrollLeftTo = scrollLeft + relativeLeft - conWidth + elWidth + scrollInlineMargin;
    scrollTopTo = scrollTop + relativeTop - conHeight + elHeight + scrollBlockMargin;
  };

  const calculateScrollToCenter = () => {
    scrollLeftTo = scrollLeft + relativeLeft - conWidth / 2 + elWidth / 2;
    scrollTopTo = scrollTop + relativeTop - conHeight / 2 + elHeight / 2;
  };

  const calculateScrollToNearest = () => {
    const isAbove = elBottom < conTop;
    const isPartialAbove = elTop < conTop && elBottom > conTop;
    const isBelow = elTop > conBottom;
    const isPartialBelow = elTop < conBottom && elBottom > conBottom;

    const isLeft = elRight < conLeft;
    const isPartialLeft = elLeft < conLeft && elRight > conLeft;
    const isRight = elLeft > conRight;
    const isPartialRight = elLeft < conRight && elRight > conRight;

    if (isAbove || isPartialAbove || isLeft || isPartialLeft) {
      calculateScrollToStart();
    } else if (isBelow || isPartialBelow || isRight || isPartialRight) {
      calculateScrollToEnd();
    }
  };

  switch (origin) {
    case 'start':
      calculateScrollToStart();
      break;
    case 'end':
      calculateScrollToEnd();
      break;
    case 'center':
      calculateScrollToCenter();
      break;
    case 'nearest':
      calculateScrollToNearest();
      break;
  }

  return {
    behavior,
    left: shouldScrollLeft ? scrollLeftTo : undefined,
    top: shouldScrollTop ? scrollTopTo : undefined,
  };
};

export interface ScrollToElementOptions {
  /**
   * The element to scroll to.
   */
  element?: HTMLElement | null;

  /**
   * The scroll container to scroll to the element in.
   * Must be provided - cannot scroll the viewport programmatically with this function.
   */
  container?: HTMLElement | null;

  /**
   * The direction to scroll in.
   * @default 'both'
   */
  direction?: 'inline' | 'block' | 'both';

  /**
   * The origin of the element to scroll to.
   * @default 'nearest'
   */
  origin?: 'start' | 'end' | 'center' | 'nearest';

  /**
   * The scroll behavior.
   * @default 'smooth'
   */
  behavior?: ScrollBehavior;

  /**
   * The scroll inline-margin
   * @default 0
   */
  scrollInlineMargin?: number;

  /**
   * The scroll block-margin
   * @default 0
   */
  scrollBlockMargin?: number;
}

export const scrollToElement = (options: ScrollToElementOptions) => {
  options.container?.scrollTo(getElementScrollCoordinates(options));
};

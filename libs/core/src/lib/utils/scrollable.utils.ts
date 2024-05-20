import { clamp } from './clamp.util';

export const elementCanScroll = (element: HTMLElement, direction?: 'x' | 'y') => {
  const { scrollHeight, clientHeight, scrollWidth, clientWidth } = element;

  if (direction === 'x') {
    return scrollWidth > clientWidth;
  } else if (direction === 'y') {
    return scrollHeight > clientHeight;
  }

  return scrollHeight > clientHeight || scrollWidth > clientWidth;
};

export interface IsElementVisibleOptions {
  /**
   * The element to check if it is visible inside a container.
   */
  element?: HTMLElement | null;

  /**
   * The container to check if the element is visible inside.
   * @default document.documentElement
   */
  container?: HTMLElement | null;

  /**
   * The container's rect to check if the element is visible inside. Can be supplied to reduce the amount of DOM reads.
   * @default container.getBoundingClientRect()
   */
  containerRect?: DOMRect | null;

  /**
   * The element's rect. Can be supplied to reduce the amount of DOM reads.
   * @default container.getBoundingClientRect()
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
}

export const isElementVisible = (options: IsElementVisibleOptions): CurrentElementVisibility | null => {
  let { container } = options;
  const { element } = options;

  if (!element || container === null) {
    return null;
  }

  container ||= document.documentElement;

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
    };
  }

  const elementRect = options.elementRect || element.getBoundingClientRect();
  const containerRect = options.containerRect || container.getBoundingClientRect();

  const elementInlineStart = elementRect.left;
  const elementBlockStart = elementRect.top;

  const containerInlineStart = containerRect.left;
  const containerBlockStart = containerRect.top;

  const elWith = elementRect.width || 1;
  const elHeight = elementRect.height || 1;

  const elementInlineEnd = elementInlineStart + elWith;
  const elementBlockEnd = elementBlockStart + elHeight;

  const containerInlineEnd = containerInlineStart + containerRect.width;
  const containerBlockEnd = containerBlockStart + containerRect.height;

  const isElementInlineVisible = elementInlineStart >= containerInlineStart && elementInlineEnd <= containerInlineEnd;
  const isElementBlockVisible = elementBlockStart >= containerBlockStart && elementBlockEnd <= containerBlockEnd;

  const inlineIntersection =
    Math.min(elementInlineEnd, containerInlineEnd) - Math.max(elementInlineStart, containerInlineStart);
  const blockIntersection =
    Math.min(elementBlockEnd, containerBlockEnd) - Math.max(elementBlockStart, containerBlockStart);

  const inlineIntersectionPercentage = clamp(inlineIntersection / elWith, 0, 1);
  const blockIntersectionPercentage = clamp(blockIntersection / elHeight, 0, 1);

  return {
    inline: isElementInlineVisible,
    block: isElementBlockVisible,
    inlineIntersection: inlineIntersectionPercentage,
    blockIntersection: blockIntersectionPercentage,
    isIntersecting: isElementInlineVisible && isElementBlockVisible,
    element,

    // Round the intersection ratio to the nearest 0.01 to avoid floating point errors and system scaling issues.
    intersectionRatio: Math.round(Math.min(inlineIntersectionPercentage, blockIntersectionPercentage) * 100) / 100,
  };
};

export const getElementScrollCoordinates = (options: ScrollToElementOptions): ScrollToOptions => {
  let { container } = options;
  const {
    element,
    direction,
    behavior = 'smooth',
    origin = 'nearest',
    scrollBlockMargin = 0,
    scrollInlineMargin = 0,
  } = options;

  if (!element || container === null) {
    return {
      behavior,
      left: undefined,
      top: undefined,
    };
  }

  container ||= document.documentElement;

  const canScroll = elementCanScroll(container);

  if (!canScroll) {
    return {
      behavior,
      left: undefined,
      top: undefined,
    };
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const { scrollLeft, scrollTop } = container;
  const { width: elementWidth, height: elementHeight, left: elementLeft, top: elementTop } = elementRect;
  const { width: containerWidth, height: containerHeight, left: containerLeft, top: containerTop } = containerRect;

  const shouldScrollLeft = direction === 'inline' || direction === 'both' || !direction;
  const shouldScrollTop = direction === 'block' || direction === 'both' || !direction;

  let scrollLeftTo = scrollLeft;
  let scrollTopTo = scrollTop;

  const scrollToElementStart = () => {
    const relativeTop = elementTop - containerTop;
    const relativeLeft = elementLeft - containerLeft;

    const amountToScrollTop = relativeTop;
    const amountToScrollLeft = relativeLeft;

    const scrollTopPosition = scrollTop + amountToScrollTop;
    const scrollLeftPosition = scrollLeft + amountToScrollLeft;

    scrollLeftTo = scrollLeftPosition - scrollInlineMargin;
    scrollTopTo = scrollTopPosition - scrollBlockMargin;
  };

  const scrollToElementEnd = () => {
    const relativeTop = elementTop - containerTop;
    const relativeLeft = elementLeft - containerLeft;

    const amountToScrollTop = relativeTop - containerHeight + elementHeight;
    const amountToScrollLeft = relativeLeft - containerWidth + elementWidth;

    const scrollTopPosition = scrollTop + amountToScrollTop;
    const scrollLeftPosition = scrollLeft + amountToScrollLeft;

    scrollLeftTo = scrollLeftPosition + scrollInlineMargin;
    scrollTopTo = scrollTopPosition + scrollBlockMargin;
  };

  const scrollToElementCenter = () => {
    const relativeTop = elementTop - containerTop;
    const relativeLeft = elementLeft - containerLeft;

    const amountToScrollTop = relativeTop - containerHeight / 2 + elementHeight / 2;
    const amountToScrollLeft = relativeLeft - containerWidth / 2 + elementWidth / 2;

    const scrollTopPosition = scrollTop + amountToScrollTop;
    const scrollLeftPosition = scrollLeft + amountToScrollLeft;

    scrollLeftTo = scrollLeftPosition;
    scrollTopTo = scrollTopPosition;
  };

  const scrollToElementNearest = () => {
    const isAbove = elementRect.bottom < containerRect.top;
    const isPartialAbove = elementRect.top < containerRect.top && elementRect.bottom > containerRect.top;

    const isBelow = elementRect.top > containerRect.bottom;
    const isPartialBelow = elementRect.top < containerRect.bottom && elementRect.bottom > containerRect.bottom;

    const isLeft = elementRect.right < containerRect.left;
    const isPartialLeft = elementRect.left < containerRect.left && elementRect.right > containerRect.left;

    const isRight = elementRect.left > containerRect.right;
    const isPartialRight = elementRect.left < containerRect.right && elementRect.right > containerRect.right;

    if (isAbove || isPartialAbove || isLeft || isPartialLeft) {
      scrollToElementStart();
    } else if (isBelow || isPartialBelow || isRight || isPartialRight) {
      scrollToElementEnd();
    }
  };

  switch (origin) {
    case 'start':
      scrollToElementStart();
      break;
    case 'end':
      scrollToElementEnd();
      break;
    case 'center':
      scrollToElementCenter();
      break;
    case 'nearest':
      scrollToElementNearest();
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
   * @default document.documentElement
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

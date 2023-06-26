import { clamp } from './clamp.util';

export const elementCanScroll = (element: HTMLElement) => {
  const { scrollHeight, clientHeight, scrollWidth, clientWidth } = element;

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
    return { inline: true, block: true, blockIntersection: 100, inlineIntersection: 100, element };
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = options.containerRect || container.getBoundingClientRect();

  const elementInlineStart = elementRect.left;
  const elementBlockStart = elementRect.top;

  const containerInlineStart = containerRect.left;
  const containerBlockStart = containerRect.top;

  const elementInlineEnd = elementInlineStart + elementRect.width;
  const elementBlockEnd = elementBlockStart + elementRect.height;

  const containerInlineEnd = containerInlineStart + containerRect.width;
  const containerBlockEnd = containerBlockStart + containerRect.height;

  const isElementInlineVisible = elementInlineStart >= containerInlineStart && elementInlineEnd <= containerInlineEnd;
  const isElementBlockVisible = elementBlockStart >= containerBlockStart && elementBlockEnd <= containerBlockEnd;

  const inlineIntersection =
    Math.min(elementInlineEnd, containerInlineEnd) - Math.max(elementInlineStart, containerInlineStart);
  const blockIntersection =
    Math.min(elementBlockEnd, containerBlockEnd) - Math.max(elementBlockStart, containerBlockStart);

  const inlineIntersectionPercentage = clamp((inlineIntersection / elementRect.width) * 100);
  const blockIntersectionPercentage = clamp((blockIntersection / elementRect.height) * 100);

  return {
    inline: isElementInlineVisible,
    block: isElementBlockVisible,
    inlineIntersection: inlineIntersectionPercentage,
    blockIntersection: blockIntersectionPercentage,
    element,
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
    return;
  }

  container ||= document.documentElement;

  const canScroll = elementCanScroll(container);

  if (!canScroll) {
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const elementInlineSize = elementRect.width;
  const elementBlockSize = elementRect.height;

  const containerInlineSize = containerRect.width;
  const containerBlockSize = containerRect.height;

  const elementInlineStart = elementRect.left;
  const elementBlockStart = elementRect.top;

  const containerInlineStart = containerRect.left;
  const containerBlockStart = containerRect.top;

  const elementInlineEnd = elementInlineStart + elementInlineSize;
  const elementBlockEnd = elementBlockStart + elementBlockSize;

  const containerInlineEnd = containerInlineStart + containerInlineSize;
  const containerBlockEnd = containerBlockStart + containerBlockSize;

  const elementInlineCenter = elementInlineStart + elementInlineSize / 2;
  const elementBlockCenter = elementBlockStart + elementBlockSize / 2;

  const containerInlineCenter = containerInlineStart + containerInlineSize / 2;
  const containerBlockCenter = containerBlockStart + containerBlockSize / 2;

  const elementInlineOrigin =
    origin === 'center' ? elementInlineCenter : origin === 'end' ? elementInlineEnd : elementInlineStart;
  const elementBlockOrigin =
    origin === 'center' ? elementBlockCenter : origin === 'end' ? elementBlockEnd : elementBlockStart;

  const containerInlineOrigin =
    origin === 'center' ? containerInlineCenter : origin === 'end' ? containerInlineEnd : containerInlineStart;
  const containerBlockOrigin =
    origin === 'center' ? containerBlockCenter : origin === 'end' ? containerBlockEnd : containerBlockStart;

  const inlineOffset = elementInlineOrigin - containerInlineOrigin - scrollInlineMargin;
  const blockOffset = elementBlockOrigin - containerBlockOrigin - scrollBlockMargin;

  let inlineScroll: number | undefined = direction === 'block' ? undefined : inlineOffset;
  let blockScroll: number | undefined = direction === 'inline' ? undefined : blockOffset;

  if (origin === 'nearest') {
    const elVisible = isElementVisible({ element, container, containerRect });

    if (elVisible?.inline && elVisible?.block) {
      return;
    }

    if (elVisible?.inline) {
      inlineScroll = undefined;
    }

    if (elVisible?.block) {
      blockScroll = undefined;
    }
  }

  container.scrollTo({
    left: container.scrollLeft + (inlineScroll || 0),
    top: container.scrollTop + (blockScroll || 0),
    behavior,
  });
};

export interface GetVisibleElementsOptions {
  /**
   * The container to check for visible elements.
   * @default document.documentElement
   */
  container?: HTMLElement | null;

  /**
   * The elements to check if they are visible inside a container.
   */
  elements: HTMLElement[];
}

export const getElementVisibleStates = (options: GetVisibleElementsOptions) => {
  let { container } = options;
  const { elements } = options;

  container ||= document.documentElement;

  const rect = container.getBoundingClientRect();

  const elementVisibleStates = elements
    .map((e) => {
      if (!e || !container) return null;

      return isElementVisible({ container, element: e, containerRect: rect });
    })
    .filter(Boolean) as CurrentElementVisibility[];

  return elementVisibleStates;
};

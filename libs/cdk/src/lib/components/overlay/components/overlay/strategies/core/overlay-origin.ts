export const isHtmlElement = (element: unknown): element is HTMLElement => element instanceof HTMLElement;
export const isTouchEvent = (event: Event): event is TouchEvent => event.type[0] === 't';
export const isPointerEvent = (event: Event): event is PointerEvent => event.type[0] === 'c';

export const findNextRelevantHtmlElement = (element: HTMLElement | null, depth = 0): HTMLElement | null => {
  if (!element || depth === 10) return null;

  if (element.tagName === 'A' || element.tagName === 'BUTTON') {
    return element;
  }

  return findNextRelevantHtmlElement(element.parentElement, depth + 1);
};

export const getOriginCoordinatesAndDimensions = (origin: HTMLElement | Event | undefined) => {
  if (!origin) return null;

  if (isHtmlElement(origin)) {
    const rect = (findNextRelevantHtmlElement(origin) ?? origin).getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      element: origin,
    };
  }

  if (isTouchEvent(origin) || isPointerEvent(origin)) {
    const target = origin.target as HTMLElement;
    const relevantElement = findNextRelevantHtmlElement(target) ?? target;
    const rect = relevantElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      element: relevantElement,
    };
  }

  return null;
};

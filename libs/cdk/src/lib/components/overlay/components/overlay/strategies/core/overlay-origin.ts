export const isHtmlElement = (element: unknown): element is HTMLElement => element instanceof HTMLElement;
export const isTouchEvent = (event: Event): event is TouchEvent => event.type[0] === 't';
export const isPointerEvent = (event: Event): event is PointerEvent => event.type[0] === 'c';

export const getOriginCoordinatesAndDimensions = (origin: HTMLElement | Event | undefined) => {
  if (!origin) return null;

  if (isHtmlElement(origin)) {
    const rect = origin.getBoundingClientRect();
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
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      element: target,
    };
  }

  return null;
};

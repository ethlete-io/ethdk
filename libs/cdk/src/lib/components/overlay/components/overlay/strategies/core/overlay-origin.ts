/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const isHtmlElement = (element: unknown): element is HTMLElement => element instanceof HTMLElement;
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const isTouchEvent = (event: Event): event is TouchEvent => event.type[0] === 't';
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const isPointerEvent = (event: Event): event is PointerEvent => event.type[0] === 'c';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const findNextRelevantHtmlElement = (element: HTMLElement | null, depth = 0): HTMLElement | null => {
  if (!element || depth === 10) return null;

  if (element.tagName === 'A' || element.tagName === 'BUTTON') {
    return element;
  }

  return findNextRelevantHtmlElement(element.parentElement, depth + 1);
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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

import { isElement, isHTMLElement } from '@ethlete/core';
import { findNextRelevantHtmlElement } from './overlay-origin';

export const resolveOriginElement = (origin: Element | Event | null | undefined) => {
  if (isElement(origin)) return origin;

  if (origin && isHTMLElement(origin.target)) {
    return findNextRelevantHtmlElement(origin.target) ?? origin.target;
  }

  return undefined;
};

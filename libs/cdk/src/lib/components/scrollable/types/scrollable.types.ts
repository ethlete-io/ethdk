export type ScrollableScrollMode = 'container' | 'element';

export interface ScrollableIntersectionChange {
  element: HTMLElement;
  intersectionRatio: number;
  isIntersecting: boolean;
  index: number;
}

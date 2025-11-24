export type ScrollableScrollMode = 'container' | 'element';

export type ScrollableIntersectionChange = {
  element: HTMLElement;
  intersectionRatio: number;
  isIntersecting: boolean;
  index: number;
};

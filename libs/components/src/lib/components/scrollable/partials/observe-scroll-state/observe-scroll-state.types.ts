export interface ScrollableScrollState {
  isAtStart: boolean;
  isAtEnd: boolean;
  canScroll: boolean;
}

export type ObservedScrollableChild = 'first' | 'last';

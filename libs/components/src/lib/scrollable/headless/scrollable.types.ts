export const SCROLLABLE_SCROLL_MODES = {
  CONTAINER: 'container',
  ELEMENT: 'element',
} as const;

export type ScrollableScrollMode = (typeof SCROLLABLE_SCROLL_MODES)[keyof typeof SCROLLABLE_SCROLL_MODES];

export const SCROLLABLE_DIRECTIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
} as const;

export type ScrollableDirection = (typeof SCROLLABLE_DIRECTIONS)[keyof typeof SCROLLABLE_DIRECTIONS];

export const SCROLLABLE_ITEM_SIZES = {
  AUTO: 'auto',
  SAME: 'same',
  HALF: 'half',
  THIRD: 'third',
  QUARTER: 'quarter',
  FULL: 'full',
} as const;

export type ScrollableItemSize = (typeof SCROLLABLE_ITEM_SIZES)[keyof typeof SCROLLABLE_ITEM_SIZES];

export const SCROLLABLE_SCROLL_ORIGINS = {
  AUTO: 'auto',
  CENTER: 'center',
  START: 'start',
  END: 'end',
} as const;

export type ScrollableScrollOrigin = (typeof SCROLLABLE_SCROLL_ORIGINS)[keyof typeof SCROLLABLE_SCROLL_ORIGINS];

export const SCROLLABLE_BUTTON_POSITIONS = {
  INSIDE: 'inside',
  FOOTER: 'footer',
} as const;

export type ScrollableButtonPosition = (typeof SCROLLABLE_BUTTON_POSITIONS)[keyof typeof SCROLLABLE_BUTTON_POSITIONS];

export const SCROLLABLE_MASK_VARIANTS = {
  GRADIENT: 'gradient',
  BORDER: 'border',
} as const;

export type ScrollableMaskVariant = (typeof SCROLLABLE_MASK_VARIANTS)[keyof typeof SCROLLABLE_MASK_VARIANTS];

export const SCROLLABLE_LOADING_TEMPLATE_POSITIONS = {
  START: 'start',
  END: 'end',
} as const;

export type ScrollableLoadingTemplatePosition =
  (typeof SCROLLABLE_LOADING_TEMPLATE_POSITIONS)[keyof typeof SCROLLABLE_LOADING_TEMPLATE_POSITIONS];

export type ScrollableIntersectionChange = {
  element: HTMLElement;
  intersectionRatio: number;
  isIntersecting: boolean;
  index: number;
};

export type ScrollableScrollState = {
  isAtStart: boolean;
  isAtEnd: boolean;
  canScroll: boolean;
};

export type ScrollableNavigationItem = {
  isActive: boolean;
  activeOffset: number;
  element: HTMLElement;
};

export type ScrollableNavigation = {
  items: ScrollableNavigationItem[];
  activeIndex: number;
};

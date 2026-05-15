export const TAB_BAR_ORIENTATIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
} as const;

export type TabBarOrientation = (typeof TAB_BAR_ORIENTATIONS)[keyof typeof TAB_BAR_ORIENTATIONS];

export const TAB_BAR_FITS = {
  CONTENT: 'content',
  FILL: 'fill',
} as const;

export type TabBarFit = (typeof TAB_BAR_FITS)[keyof typeof TAB_BAR_FITS];

export const TAB_BAR_VARIANTS = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
} as const;

export type TabBarVariant = (typeof TAB_BAR_VARIANTS)[keyof typeof TAB_BAR_VARIANTS];

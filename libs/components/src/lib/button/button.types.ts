export const BUTTON_SIZES = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

export type ButtonSize = (typeof BUTTON_SIZES)[keyof typeof BUTTON_SIZES];

export const BUTTON_ICON_ALIGNMENTS = {
  START: 'start',
  END: 'end',
} as const;

export type ButtonIconAlignment = (typeof BUTTON_ICON_ALIGNMENTS)[keyof typeof BUTTON_ICON_ALIGNMENTS];

export const BUTTON_VARIANTS = {
  FILLED: 'filled',
  OUTLINE: 'outline',
  TONAL: 'tonal',
  TRANSPARENT: 'transparent',
} as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];

export const BUTTON_SPINNER_CONFIG: Record<ButtonSize, { diameter: number; strokeWidth: number }> = {
  xs: { diameter: 12, strokeWidth: 1.5 },
  sm: { diameter: 14, strokeWidth: 1.75 },
  md: { diameter: 16, strokeWidth: 2 },
  lg: { diameter: 20, strokeWidth: 2.5 },
  xl: { diameter: 24, strokeWidth: 3 },
};

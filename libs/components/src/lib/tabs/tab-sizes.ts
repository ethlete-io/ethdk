export const TAB_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;

export type TabSize = (typeof TAB_SIZES)[keyof typeof TAB_SIZES];

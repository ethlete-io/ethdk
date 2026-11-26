export const TOOLBAR_ORIENTATIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
} as const;

export type ToolbarOrientation = (typeof TOOLBAR_ORIENTATIONS)[keyof typeof TOOLBAR_ORIENTATIONS];

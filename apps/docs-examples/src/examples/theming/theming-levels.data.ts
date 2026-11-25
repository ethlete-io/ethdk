import { SurfaceType } from '@ethlete/core';

export type ThemingLevelRow = {
  id: number;
  name: string;
  value: string;
};

export const SCHEMES: SurfaceType[] = ['dark', 'light'];

export const TONES = ['brand', 'success', 'warning', 'danger', 'neutral'];

export const SURFACE_VALUES = [
  { label: 'background', token: '--et-surface-background-solid' },
  { label: 'text', token: '--et-surface-color-solid' },
  { label: 'muted', token: '--et-surface-color-muted-solid' },
  { label: 'subtle', token: '--et-surface-color-subtle-solid' },
  { label: 'border', token: '--et-surface-border-solid' },
];

export const ROWS: ThemingLevelRow[] = [
  { id: 1, name: 'Hover', value: 'tint' },
  { id: 2, name: 'Pressed', value: 'stronger tint' },
];

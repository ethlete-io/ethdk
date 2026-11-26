import { SurfaceType } from '@ethlete/core';

export type ThemingLevelRow = {
  id: number;
  name: string;
  value: string;
};

export const SCHEMES: SurfaceType[] = ['dark', 'light'];

export const TONES = ['brand', 'success', 'warning', 'danger', 'neutral'];

export const SURFACE_VALUES = [
  { label: 'background', token: '--et-surface-background' },
  { label: 'text', token: '--et-surface-text' },
  { label: 'muted', token: '--et-surface-text-muted' },
  { label: 'subtle', token: '--et-surface-text-subtle' },
  { label: 'border', token: '--et-surface-border' },
];

export const ROWS: ThemingLevelRow[] = [
  { id: 1, name: 'Hover', value: 'tint' },
  { id: 2, name: 'Pressed', value: 'stronger tint' },
];

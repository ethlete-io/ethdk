import { type IconName } from '@system/foundations/icons';

type SketchPoint = { icon: IconName; text: string; detail: string };

export const SKETCH_POINTS: SketchPoint[] = [
  { icon: 'grid', text: 'Sketch gewählt, noch nicht gemergt', detail: 'sketch' },
  { icon: 'error', text: 'Sketch-Regel verletzt: UTILITY-CSS', detail: 'b' },
  { icon: 'error', text: 'Sketch-Regel verletzt: UTILITY-CSS', detail: 'b' },
];

export const openLabel = (count: number) => `${count} offen`;

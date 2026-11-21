import { type IconName } from '@system/foundations/icons';
import { STUDIO_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/studio-labels';

type SketchPoint = { icon: IconName; text: string; detail: string };

export const SKETCH_POINTS: SketchPoint[] = [
  { icon: 'grid', text: STUDIO_LABELS.system.sketchPicked, detail: 'sketch' },
  { icon: 'error', text: 'Sketch-Regel verletzt: UTILITY-CSS', detail: 'b' },
  { icon: 'error', text: 'Sketch-Regel verletzt: UTILITY-CSS', detail: 'b' },
];

export const openLabel = (count: number) => `${count} offen`;

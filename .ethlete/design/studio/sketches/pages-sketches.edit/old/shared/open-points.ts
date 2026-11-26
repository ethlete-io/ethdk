import { type IconName } from '@system/foundations/icons';
import { SYSTEM_LABELS } from '../../../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

type SketchPoint = { icon: IconName; text: string; detail: string };

export const SKETCH_POINTS: SketchPoint[] = [{ icon: 'grid', text: SYSTEM_LABELS.sketchPicked, detail: 'sketch' }];

export const openLabel = (count: number) => `${count} offen`;

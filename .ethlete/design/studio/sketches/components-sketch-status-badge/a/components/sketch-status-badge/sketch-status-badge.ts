import { definePart } from '@design-system';
import badge from '@system/components/badge';

export type SketchStatus = 'drawing' | 'waiting' | 'paused' | 'idle';

export type SketchBadgeStatus = SketchStatus | 'failed';

type Props = { status: SketchBadgeStatus };

const LABEL: Record<SketchBadgeStatus, string> = {
  drawing: 'zeichnet',
  waiting: 'Wartet auf deine Wahl',
  paused: 'Pausiert',
  idle: 'Keine Aktivität',
  failed: 'Render fehlgeschlagen',
};

export const sketchStatusBadge = async (status: SketchBadgeStatus) =>
  (await badge.render({ badges: [{ label: LABEL[status], variant: 'tonal', size: 'sm' }] })) as {
    body: string;
    styles: string;
  };

export default definePart({
  note: 'The status of a sketch as a small tonal badge: zeichnet while a variant is drawn, Wartet auf deine Wahl when all stand, Pausiert while the agent waits on other work, Keine Aktivität when nothing moved for a while, Render fehlgeschlagen when its render failed. The host places it, and wraps the paused badge in the hold trigger.',
  madeBy: ['claude-opus-5-5'],
  widths: [200],
  states: {
    drawing: { status: 'drawing' },
    waiting: { status: 'waiting' },
    paused: { status: 'paused' },
    idle: { status: 'idle' },
    failed: { status: 'failed' },
  },
  controls: {},
  instant: 'The badge swaps its label at once when the sketch status changes.',
  render: ({ status }: Props) => sketchStatusBadge(status),
});

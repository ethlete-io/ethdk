import { definePart } from '@design-system';
import badge from '@system/components/badge';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';

export type SketchStatus = 'drawing' | 'waiting' | 'paused';

export type SketchBadgeStatus = SketchStatus | 'failed';

type Props = { status: SketchBadgeStatus };

const LABEL: Record<SketchBadgeStatus, string> = {
  drawing: SKETCHES_LABELS.status.drawing,
  waiting: SKETCHES_LABELS.status.waiting,
  paused: 'Pausiert',
  failed: SKETCHES_LABELS.status.failed,
};

export const sketchStatusBadge = async (status: SketchBadgeStatus) => {
  const { body, styles } = (await badge.render({
    badges: [{ label: LABEL[status], variant: 'tonal', size: 'sm' }],
  })) as { body: string; styles: string };

  return {
    body: status === 'failed' ? `<span class="flex w-fit" data-et-semantic-color="error">${body}</span>` : body,
    styles,
  };
};

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-status-badge/sketch-status-badge.component.ts',
  note: 'The status of a sketch as a small tonal badge: zeichnet while a variant is drawn, Wartet auf deine Wahl when all stand and wait for the pick, which merges at once, and Pausiert while the agent waits on other work. Render fehlgeschlagen, when its render failed, takes the error colour theme by its semantic type. The host places it, and wraps the paused badge in the hold trigger.',
  madeBy: ['claude-opus-5-5', 'design check'],
  widths: [200],
  states: {
    drawing: { status: 'drawing' },
    waiting: { status: 'waiting' },
    paused: { status: 'paused' },
    failed: { status: 'failed' },
  },
  describe: {
    drawing: 'The tonal badge zeichnet while a variant is drawn; check that it fits its label on one line.',
    waiting: 'The tonal badge Wartet auf deine Wahl; check that the longest label stays on one line inside 200px.',
    paused: 'The tonal badge Pausiert; check that it keeps the same height and padding as the others.',
    failed:
      'The badge Render fehlgeschlagen in the error colour; check that the tint and text switch to the error theme.',
  },
  controls: {},
  instant: 'The badge swaps its label at once when the sketch status changes.',
  render: ({ status }: Props) => sketchStatusBadge(status),
});

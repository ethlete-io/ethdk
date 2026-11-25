import { definePart } from '@design-system';
import { SKETCHES_LABELS } from '../../../../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';

export type SketchStatus = 'drawing' | 'waiting' | 'paused';

export type SketchBadgeStatus = SketchStatus | 'failed' | 'merging';

type Props = { status: SketchBadgeStatus };

const LABEL: Record<SketchBadgeStatus, string> = {
  drawing: SKETCHES_LABELS.status.drawing,
  waiting: SKETCHES_LABELS.status.waiting,
  paused: 'Pausiert',
  failed: SKETCHES_LABELS.status.failed,
  merging: SKETCHES_LABELS.status.merging,
};

const DOT: Record<SketchBadgeStatus, string> = {
  drawing: 'bg-(--et-theme-color-primary-solid) animate-pulse',
  waiting: 'bg-(--et-theme-color-primary-solid)',
  paused: 'bg-et-surface-muted',
  failed: 'bg-(--et-theme-color-primary-solid)',
  merging: 'bg-(--et-theme-color-primary-solid) animate-pulse',
};

export const sketchStatusBadge = async (status: SketchBadgeStatus) => ({
  body: `<span class="flex w-fit items-center gap-space-2 text-ui-sm font-ui-medium whitespace-nowrap ${status === 'failed' ? 'text-(--et-theme-color-primary-solid)' : 'text-et-surface'}"${status === 'failed' ? ' data-et-semantic-color="error"' : ''} data-sk-status="${status}"><span class="size-2 flex-none rounded-full ${DOT[status]}"></span>${LABEL[status]}</span>`,
  styles: '',
});

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-status-badge/sketch-status-badge.component.ts',
  note: 'The status of a sketch as a status dot with its label, in the look of the agent and port lines of the sketch head: zeichnet while a variant is drawn, Wartet auf deine Wahl when all stand and wait for the pick, which merges at once, Pausiert while the agent waits on other work, and Wird übernommen while a pick merges. Render fehlgeschlagen, when its render failed, takes the error colour theme by its semantic type. The host places it, and wraps the paused badge in the hold trigger.',
  madeBy: ['claude-opus-5-5', 'design check'],
  widths: [200],
  states: {
    drawing: { status: 'drawing' },
    waiting: { status: 'waiting' },
    paused: { status: 'paused' },
    failed: { status: 'failed' },
    merging: { status: 'merging' },
  },
  describe: {
    drawing: 'The pulsing dot and zeichnet while a variant is drawn; check that it fits its label on one line.',
    waiting: 'The accent dot and Wartet auf deine Wahl; check that the longest label stays on one line inside 200px.',
    paused: 'The muted dot and Pausiert; check that it keeps the same height as the others.',
    failed: 'Render fehlgeschlagen in the error colour; check that the dot and text switch to the error theme.',
    merging:
      'The pulsing dot and Wird übernommen while a picked variant merges; check that it keeps the height of the others.',
  },
  controls: {},
  instant: 'The status swaps its label at once when the sketch status changes.',
  render: ({ status }: Props) => sketchStatusBadge(status),
});

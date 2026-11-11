import { definePart } from '@design-system';
import badge from '@system/components/badge';

export type SketchStatus = 'drawing' | 'waiting' | 'picked' | 'paused' | 'idle';

export type SketchBadgeStatus = SketchStatus | 'failed';

type Props = { status: SketchBadgeStatus };

const LABEL: Record<SketchBadgeStatus, string> = {
  drawing: 'zeichnet',
  waiting: 'Wartet auf deine Wahl',
  picked: 'Gewählt, Merge offen',
  paused: 'Pausiert',
  idle: 'Keine Aktivität',
  failed: 'Render fehlgeschlagen',
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
  note: 'The status of a sketch as a small tonal badge: zeichnet while a variant is drawn, Wartet auf deine Wahl when all stand and nothing is picked, Gewählt, Merge offen once the designer picked a variant and the merge is still to come, Pausiert while the agent waits on other work, Keine Aktivität when nothing moved for a while. Render fehlgeschlagen, when its render failed, takes the error colour theme by its semantic type. The host places it, and wraps the paused badge in the hold trigger.',
  madeBy: ['claude-opus-5-5'],
  widths: [200],
  states: {
    drawing: { status: 'drawing' },
    waiting: { status: 'waiting' },
    picked: { status: 'picked' },
    paused: { status: 'paused' },
    idle: { status: 'idle' },
    failed: { status: 'failed' },
  },
  controls: {},
  instant: 'The badge swaps its label at once when the sketch status changes.',
  render: ({ status }: Props) => sketchStatusBadge(status),
});

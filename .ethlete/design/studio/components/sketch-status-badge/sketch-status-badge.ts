import { iconButton, iconButtonStyles } from '@ethlete/components/design/button';
import { control } from '@ethlete/components/design/control';
import { iconMarkup } from '@ethlete/components/design/icon';
import { definePart, forceInteraction, interactionRows } from '@design-system';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';
import {
  SKETCH_STATUS_ICONS,
  SKETCH_STATUS_TONE,
  type SketchBadgeStatus,
} from '../../../../../apps/ethlete-studio/src/app/icons/sketch-status-icons';

export type { SketchBadgeStatus };

export type SketchStatus = 'drawing' | 'waiting' | 'paused';

type StatusInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { status: SketchBadgeStatus; open?: boolean; note?: string; interaction?: StatusInteraction };

const SCOPE: Partial<Record<SketchBadgeStatus, string>> = {
  failed: ' data-et-semantic-color="error"',
  autoMerge: ' data-et-semantic-color="success"',
  approved: ' data-et-semantic-color="success"',
};

const tipMarkup = (status: SketchBadgeStatus, note?: string) => {
  const { label, detail } = SKETCHES_LABELS.statusTip[status];
  const noteLine = note ? `<span class="text-et-surface-text-muted">${note}</span>` : '';

  return `<span role="status" class="absolute top-full left-0 z-10 mt-space-1 flex w-56 flex-col gap-space-1 rounded-control-md border border-et-surface-border bg-(--et-surface-background) p-space-3 text-ui-sm" data-sk-status-tip><span class="font-ui-medium text-et-surface-text">${label}</span><span class="text-et-surface-text-muted">${detail}</span>${noteLine}</span>`;
};

export const sketchStatusBadge = async (
  status: SketchBadgeStatus,
  open = false,
  { note, interaction }: Pick<Props, 'note' | 'interaction'> = {},
) => {
  const button = control(
    iconButton({
      icon: iconMarkup(SKETCH_STATUS_ICONS[status], `flex size-4 ${SKETCH_STATUS_TONE[status]}`),
      ariaLabel: SKETCHES_LABELS.statusTip[status].label,
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
    }).replace(/^<button /, `<button aria-expanded="${open}" data-sk-status-button `),
    'status',
  );
  const forced = interaction ? forceInteraction(button, interaction) : button;

  return {
    body: `<span class="block ${open ? 'h-36' : ''}"><span class="relative inline-flex" data-sk-status="${status}"${SCOPE[status] ?? ''}>${forced}${open ? tipMarkup(status, note) : ''}</span></span>`,
    styles: iconButtonStyles,
  };
};

const rows = interactionRows<
  Props,
  | 'waiting'
  | 'drawing'
  | 'awaiting-approval'
  | 'awaiting-sub-parts'
  | 'approved'
  | 'paused'
  | 'failed'
  | 'merging'
  | 'auto-merge'
  | 'toggletip-open'
  | 'toggletip-note',
  StatusInteraction,
  | 'drawing'
  | 'awaiting-approval'
  | 'awaiting-sub-parts'
  | 'approved'
  | 'paused'
  | 'failed'
  | 'merging'
  | 'auto-merge'
  | 'toggletip-open'
  | 'toggletip-note'
>(
  {
    waiting: { status: 'waiting' },
    drawing: { status: 'drawing' },
    'awaiting-approval': { status: 'awaitingApproval' },
    'awaiting-sub-parts': { status: 'awaitingSubParts' },
    approved: { status: 'approved' },
    paused: { status: 'paused' },
    failed: { status: 'failed' },
    merging: { status: 'merging' },
    'auto-merge': { status: 'autoMerge' },
    'toggletip-open': { status: 'waiting', open: true },
    'toggletip-note': { status: 'paused', open: true, note: 'Wartet auf components/button.' },
  },
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({ ...props, interaction }),
    restOnly: [
      'drawing',
      'awaiting-approval',
      'awaiting-sub-parts',
      'approved',
      'paused',
      'failed',
      'merging',
      'auto-merge',
      'toggletip-open',
      'toggletip-note',
    ],
  },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-status-badge/sketch-status-badge.component.ts',
  note: 'Der Status einer Skizze als et-icon-button sm fester Breite statt Punkt mit Wort. Zeichnen und Übernahme pulsieren sanft per Deckkraft, Fehler und Automatik tragen ihr Farbthema, Pausiert und Unterteile sind gedämpft. Ein Klick öffnet einen Toggletip mit Wort, Details und, falls vorhanden, der Notiz zum Halte-Grund; die Breite des Badges ändert sich nie.',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5', 'design check'],
  widths: [240],
  frame: (body) => `<div class="p-space-2">${body}</div>`,
  states: rows.states,
  grid: rows.grid,
  describe: {
    waiting: 'Die Abzweigung für die Variantenwahl als transparenter Icon-Knopf; prüfe, dass er 24px breit ist.',
    'waiting-hover': 'Der Knopf gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'waiting-active': 'Der Knopf gedrückt; prüfe die SDK-Press-Fläche.',
    'waiting-focus-visible': 'Der Knopf per Tastatur fokussiert; prüfe den SDK-Fokusring.',
    drawing:
      'Der pulsierende Stift beim Zeichnen; prüfe, dass das Symbol lesbar ist und das Badge gleich breit bleibt.',
    'awaiting-approval': 'Das Auge für die Freigabe; prüfe die gleiche Breite.',
    'awaiting-sub-parts': 'Die Ebenen für Unterteile, gedämpft; prüfe die gleiche Breite.',
    approved: 'Der Haken im Erfolgsthema; prüfe die gleiche Breite.',
    paused: 'Die Pause gedämpft; prüfe, dass sie nicht wie deaktiviert wirkt, aber ruhiger als die anderen.',
    failed: 'Das Warndreieck im Fehlerthema; prüfe, dass es sich vom Akzent abhebt.',
    merging: 'Das pulsierende Merge-Symbol; prüfe die gleiche Breite.',
    'auto-merge': 'Der Blitz im Erfolgsthema; prüfe die gleiche Breite.',
    'toggletip-open':
      'Der Toggletip nach einem Klick mit Wort und Details; prüfe, dass das Badge selbst gleich breit bleibt.',
    'toggletip-note':
      'Der Toggletip einer pausierten Skizze mit der Notiz zum Halte-Grund als dritter, gedämpfter Zeile; prüfe, dass sie unter den Details steht.',
  },
  controls: { status: { kind: 'button', input: ['pointer', 'keyboard'] } },
  instant: 'Das Symbol wechselt sofort; nur Zeichnen und Übernahme blenden sanft per Deckkraft.',
  render: ({ status, open, note, interaction }: Props) => sketchStatusBadge(status, open, { note, interaction }),
});

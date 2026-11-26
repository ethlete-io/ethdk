import { iconButton, iconButtonStyles } from '@ethlete/components/design/button';
import { control } from '@ethlete/components/design/control';
import { iconMarkup } from '@ethlete/components/design/icon';
import { toggletip, toggletipStyles } from '@ethlete/components/design/toggletip';
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

const ROW: Record<SketchBadgeStatus, StatusRow> = {
  waiting: 'waiting',
  drawing: 'drawing',
  awaitingApproval: 'awaiting-approval',
  awaitingSubParts: 'awaiting-sub-parts',
  approved: 'approved',
  paused: 'paused',
  failed: 'failed',
  merging: 'merging',
  autoMerge: 'auto-merge',
};

type StatusRow =
  | 'waiting'
  | 'drawing'
  | 'awaiting-approval'
  | 'awaiting-sub-parts'
  | 'approved'
  | 'paused'
  | 'failed'
  | 'merging'
  | 'auto-merge';

type OpenRow = `${StatusRow}-open` | 'paused-open-note';

const tipMarkup = (status: SketchBadgeStatus, note?: string) => {
  const { label, detail } = SKETCHES_LABELS.statusTip[status];
  const noteLine = note ? `<span class="text-et-surface-text-muted">${note}</span>` : '';

  return `<span class="absolute bottom-full left-0 z-10 mb-2.5 w-max">${toggletip({
    content: `<div class="flex flex-col gap-space-1 text-ui-sm" data-toggletip-body data-sk-status-tip><span class="font-ui-medium text-et-surface-text">${label}</span><span class="text-et-surface-text-muted">${detail}</span>${noteLine}</div>`,
    anchor: '[data-sk-status-button]',
    ariaLabel: label,
  })}</span>`;
};

export const sketchStatusBadge = async (
  status: SketchBadgeStatus,
  open = false,
  { note, interaction, action }: Pick<Props, 'note' | 'interaction'> & { action?: string } = {},
) => {
  const button = control(
    iconButton({
      icon: iconMarkup(SKETCH_STATUS_ICONS[status], `flex size-4 ${SKETCH_STATUS_TONE[status]}`),
      ariaLabel: SKETCHES_LABELS.statusTip[status].label,
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
    }).replace(
      /^<button /,
      `<button aria-expanded="${open}" aria-haspopup="dialog"${action ? ` data-et-action="${action}"` : ''} data-sk-status-button `,
    ),
    'status',
  );
  const forced = interaction ? forceInteraction(button, interaction) : button;

  return {
    body: `<span class="relative inline-flex" data-sk-status="${status}"${SCOPE[status] ?? ''}>${forced}${open ? tipMarkup(status, note) : ''}</span>`,
    styles: [iconButtonStyles, toggletipStyles].join('\n'),
  };
};

const statuses = Object.keys(ROW) as SketchBadgeStatus[];
const openRows = [...statuses.map((status) => `${ROW[status]}-open` as const), 'paused-open-note' as const];

const rows = interactionRows<Props, StatusRow | OpenRow, StatusInteraction, OpenRow>(
  {
    ...(Object.fromEntries(statuses.map((status) => [ROW[status], { status }])) as Record<StatusRow, Props>),
    ...(Object.fromEntries(statuses.map((status) => [`${ROW[status]}-open`, { status, open: true }])) as Record<
      `${StatusRow}-open`,
      Props
    >),
    'paused-open-note': { status: 'paused', open: true, note: 'Wartet auf components/button.' },
  },
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({ ...props, interaction }),
    restOnly: openRows,
  },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-status-badge/sketch-status-badge.component.ts',
  note: 'Der Status einer Skizze als et-icon-button sm fester Breite statt Punkt mit Wort. Zeichnen und Übernahme pulsieren sanft per Deckkraft, Fehler und Automatik tragen ihr Farbthema, Pausiert und Unterteile sind gedämpft. Ein Klick öffnet einen Toggletip mit Wort, Details und, falls vorhanden, der Notiz zum Halte-Grund; die Breite des Badges ändert sich nie.',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5', 'design check'],
  frame: (body) => `<div class="p-space-2">${body}</div>`,
  states: rows.states,
  grid: rows.grid,
  describe: {
    waiting: 'Die Abzweigung für die Variantenwahl als transparenter Icon-Knopf; prüfe, dass er 24px breit ist.',
    'waiting-hover': 'Variante auswählen gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'waiting-active': 'Variante auswählen gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'waiting-focus-visible':
      'Variante auswählen per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'waiting-open':
      'Der Toggletip „Variante auswählen“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    drawing:
      'Der pulsierende Stift beim Zeichnen; prüfe, dass das Symbol lesbar ist und das Badge gleich breit bleibt.',
    'drawing-hover': 'Agent zeichnet gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'drawing-active': 'Agent zeichnet gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'drawing-focus-visible': 'Agent zeichnet per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'drawing-open':
      'Der Toggletip „Agent zeichnet“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    'awaiting-approval': 'Das Auge für die Freigabe; prüfe die gleiche Breite.',
    'awaiting-approval-hover': 'Skizze freigeben gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'awaiting-approval-active': 'Skizze freigeben gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'awaiting-approval-focus-visible':
      'Skizze freigeben per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'awaiting-approval-open':
      'Der Toggletip „Skizze freigeben“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    'awaiting-sub-parts': 'Die Ebenen für Unterteile, gedämpft; prüfe die gleiche Breite.',
    'awaiting-sub-parts-hover': 'Unterteile freigeben gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'awaiting-sub-parts-active': 'Unterteile freigeben gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'awaiting-sub-parts-focus-visible':
      'Unterteile freigeben per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'awaiting-sub-parts-open':
      'Der Toggletip „Unterteile freigeben“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    approved: 'Der Haken im Erfolgsthema; prüfe die gleiche Breite.',
    'approved-hover': 'Freigegeben gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'approved-active': 'Freigegeben gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'approved-focus-visible': 'Freigegeben per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'approved-open':
      'Der Toggletip „Freigegeben“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    paused: 'Die Pause gedämpft; prüfe, dass sie nicht wie deaktiviert wirkt, aber ruhiger als die anderen.',
    'paused-hover': 'Pausiert gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'paused-active': 'Pausiert gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'paused-focus-visible': 'Pausiert per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'paused-open':
      'Der Toggletip „Pausiert“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    failed: 'Das Warndreieck im Fehlerthema; prüfe, dass es sich vom Akzent abhebt.',
    'failed-hover': 'Fehler prüfen gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'failed-active': 'Fehler prüfen gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'failed-focus-visible': 'Fehler prüfen per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'failed-open':
      'Der Toggletip „Fehler prüfen“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    merging: 'Das pulsierende Merge-Symbol; prüfe die gleiche Breite.',
    'merging-hover': 'Variante wird übernommen gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'merging-active': 'Variante wird übernommen gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'merging-focus-visible':
      'Variante wird übernommen per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'merging-open':
      'Der Toggletip „Variante wird übernommen“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    'auto-merge': 'Der Blitz im Erfolgsthema; prüfe die gleiche Breite.',
    'auto-merge-hover': 'Wird automatisch übernommen gehovert; prüfe die SDK-Hover-Fläche hinter dem Symbol.',
    'auto-merge-active': 'Wird automatisch übernommen gedrückt; prüfe die SDK-Press-Fläche, kräftiger als beim Hover.',
    'auto-merge-focus-visible':
      'Wird automatisch übernommen per Tastatur fokussiert; prüfe den SDK-Fokusring, nicht abgeschnitten.',
    'auto-merge-open':
      'Der Toggletip „Wird automatisch übernommen“ nach einem Klick, mittig über dem Knopf mit Pfeil; prüfe Wort und Details und dass das Badge gleich breit bleibt.',
    'paused-open-note':
      'Der Toggletip einer pausierten Skizze mit der Notiz zum Halte-Grund als dritter, gedämpfter Zeile; prüfe, dass sie unter den Details steht.',
  },
  controls: { status: { kind: 'button', input: ['pointer', 'keyboard'] } },
  instant: 'Das Symbol wechselt sofort; nur Zeichnen und Übernahme blenden sanft per Deckkraft.',
  render: ({ status, open, note, interaction }: Props) =>
    sketchStatusBadge(status, open, { note, interaction, action: open ? ROW[status] : `${ROW[status]}-open` }),
});

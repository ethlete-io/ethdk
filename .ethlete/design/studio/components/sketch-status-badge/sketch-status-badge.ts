import { control } from '@ethlete/components/design/control';
import { definePart } from '@design-system';

export type SketchStatus = 'drawing' | 'waiting' | 'paused';

export type SketchBadgeStatus =
  SketchStatus | 'awaitingApproval' | 'awaitingSubParts' | 'approved' | 'failed' | 'merging' | 'autoMerge';

type Props = { status: SketchBadgeStatus; open?: boolean };

const ICON: Record<SketchBadgeStatus, string> = {
  drawing: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  waiting:
    '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  awaitingApproval: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  awaitingSubParts: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  approved: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  paused: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  failed:
    '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  merging:
    '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M6 9a9 9 0 0 0 9 9"/>',
  autoMerge: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
};

const LABEL: Record<SketchBadgeStatus, string> = {
  drawing: 'Agent zeichnet',
  waiting: 'Variante auswählen',
  awaitingApproval: 'Skizze freigeben',
  awaitingSubParts: 'Unterteile freigeben',
  approved: 'Freigegeben',
  paused: 'Pausiert',
  failed: 'Fehler prüfen',
  merging: 'Variante wird übernommen',
  autoMerge: 'Wird automatisch übernommen',
};

const DETAIL: Record<SketchBadgeStatus, string> = {
  drawing: 'Der Agent zeichnet gerade eine Variante.',
  waiting: 'Alle Varianten stehen. Wähle eine aus, sie wird sofort übernommen.',
  awaitingApproval: 'Die Skizze wartet auf deine Freigabe. Gib sie frei.',
  awaitingSubParts: 'Gib zuerst die Unterteile frei, danach folgt diese Skizze.',
  approved: 'Du hast die Skizze freigegeben.',
  paused: 'Der Agent macht weiter, sobald andere Arbeit fertig ist.',
  failed: 'Der Render ist fehlgeschlagen. Prüfe den Fehler.',
  merging: 'Die gewählte Variante wird gerade übernommen.',
  autoMerge: 'Die Skizze wird ohne dein Zutun übernommen.',
};

const TONE: Record<SketchBadgeStatus, string> = {
  drawing: 'text-(--et-tone-fill) animate-pulse',
  waiting: 'text-(--et-tone-fill)',
  awaitingApproval: 'text-(--et-tone-fill)',
  awaitingSubParts: 'text-et-surface-text-muted',
  approved: 'text-et-surface-text',
  paused: 'text-et-surface-text-muted',
  failed: 'text-(--et-tone-fill)',
  merging: 'text-(--et-tone-fill) animate-pulse',
  autoMerge: 'text-(--et-tone-fill)',
};

const SCOPE: Partial<Record<SketchBadgeStatus, string>> = {
  failed: ' data-et-semantic-color="error"',
  autoMerge: ' data-et-semantic-color="success"',
  approved: ' data-et-semantic-color="success"',
};

export const sketchStatusBadge = async (status: SketchBadgeStatus, open = false) => {
  const label = LABEL[status];
  const tip = open
    ? `<span role="status" class="absolute top-full left-0 z-10 mt-space-1 flex w-48 flex-col gap-space-1 rounded-control-md border border-et-surface-border bg-(--et-surface-background) p-space-3 text-ui-sm text-(--et-surface-text)"><span class="font-ui-medium">${label}</span><span class="text-(--et-surface-text-muted)">${DETAIL[status]}</span></span>`
    : '';
  return {
    body: `<span class="block ${open ? 'h-28' : ''}"><span class="relative inline-flex">${control(`<button type="button" aria-label="${label}" aria-expanded="${open}" data-sk-status="${status}"${SCOPE[status] ?? ''} class="flex size-6 flex-none items-center justify-center rounded-control-sm ${open ? 'bg-et-surface-interaction/15' : ''}"><svg data-et-drawing class="size-4 ${TONE[status]}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[status]}</svg></button>`, 'status')}${tip}</span></span>`,
    styles: '',
  };
};

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-status-badge/sketch-status-badge.component.ts',
  note: 'Der Status einer Skizze als Symbol fester Breite statt Punkt mit Wort. Zeichnen und Übernahme pulsieren sanft per Deckkraft, Fehler und Automatik tragen ihr Farbthema, Pausiert und Unterteile sind gedämpft. Ein Klick öffnet einen Toggletip mit Wort und Details; die Breite des Badges ändert sich nie.',
  madeBy: ['claude-sonnet-5-5', 'design check'],
  widths: [200],
  states: {
    drawing: { status: 'drawing' },
    waiting: { status: 'waiting' },
    'awaiting-approval': { status: 'awaitingApproval' },
    'awaiting-sub-parts': { status: 'awaitingSubParts' },
    approved: { status: 'approved' },
    paused: { status: 'paused' },
    failed: { status: 'failed' },
    merging: { status: 'merging' },
    'auto-merge': { status: 'autoMerge' },
    'toggletip-open': { status: 'waiting', open: true },
  },
  describe: {
    drawing: 'Der pulsierende Stift beim Zeichnen; prüfe, dass das Symbol lesbar ist und das Badge 24px breit bleibt.',
    waiting: 'Die Abzweigung für die Variantenwahl; prüfe, dass die Breite der des Zeichnens entspricht.',
    'awaiting-approval': 'Das Auge für die Freigabe; prüfe die gleiche Breite.',
    'awaiting-sub-parts': 'Die Ebenen für Unterteile, gedämpft; prüfe die gleiche Breite.',
    approved: 'Der Haken im Erfolgsthema; prüfe die gleiche Breite.',
    paused: 'Die Pause gedämpft; prüfe, dass sie nicht wie deaktiviert wirkt, aber ruhiger als die anderen.',
    failed: 'Das Warndreieck im Fehlerthema; prüfe, dass es sich vom Akzent abhebt.',
    merging: 'Das pulsierende Merge-Symbol; prüfe die gleiche Breite.',
    'auto-merge': 'Der Blitz im Erfolgsthema; prüfe die gleiche Breite.',
    'toggletip-open':
      'Der Toggletip nach einem Klick mit Wort und Details; prüfe, dass das Badge selbst gleich breit bleibt.',
  },
  controls: { status: { kind: 'button', input: ['pointer', 'keyboard'] } },
  instant: 'Das Symbol wechselt sofort; nur Zeichnen und Übernahme blenden sanft per Deckkraft.',
  render: ({ status, open }: Props) => sketchStatusBadge(status, open),
});

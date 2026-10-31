import { icon, type IconName } from '@system/foundations/icons';

type OpenPoint =
  | { kind: 'missing-state'; control: string | null }
  | { kind: 'contrast'; state: string; path: string }
  | { kind: 'open-comment'; comment: string; state: string; answered: boolean }
  | { kind: 'unlinked' }
  | { kind: 'missing-motion'; from: string; to: string };

export type PartOpenPoints = { part: string; points: OpenPoint[] };

type Kind = OpenPoint['kind'];

const STATES = ['filled', 'outline', 'tonal', 'hover', 'active', 'focus-visible', 'disabled'];

const motions = STATES.flatMap((from) => STATES.filter((to) => to !== from).map((to) => [from, to] as const));

export const buttonPoints: PartOpenPoints = {
  part: 'components/button',
  points: [
    { kind: 'missing-state', control: null },
    { kind: 'contrast', state: 'tonal', path: 'label' },
    { kind: 'open-comment', comment: '20261030T145229Z-6541', state: 'outline', answered: false },
    { kind: 'open-comment', comment: '20261031T102204Z-1180', state: 'filled', answered: true },
    { kind: 'unlinked' },
    ...motions.map(([from, to]): OpenPoint => ({ kind: 'missing-motion', from, to })),
  ],
};

export const nothingOpen: PartOpenPoints = { part: 'components/button', points: [] };

type PointLine = { text: string; detail: string };

export type PointGroup = { kind: Kind; title: string; short: string; icon: IconName; lines: PointLine[] };

const KINDS: { kind: Kind; title: string; short: string; icon: IconName }[] = [
  { kind: 'missing-state', title: 'Fehlende Zustände', short: 'Zustände', icon: 'grid' },
  { kind: 'contrast', title: 'Kontrast unter der Regel', short: 'Kontrast', icon: 'warning' },
  { kind: 'open-comment', title: 'Offene Kommentare', short: 'Kommentare', icon: 'comment' },
  { kind: 'unlinked', title: 'Kein implements', short: 'implements', icon: 'error' },
  { kind: 'missing-motion', title: 'Fehlende Motions', short: 'Motions', icon: 'flow' },
];

const lineOf = (point: OpenPoint): PointLine => {
  switch (point.kind) {
    case 'missing-state':
      return point.control
        ? { text: `${point.control} hat keinen gezeichneten Zustand`, detail: point.control }
        : { text: 'Keine Controls deklariert', detail: 'controls' };
    case 'contrast':
      return { text: `${point.path} liegt unter der Kontrastregel`, detail: point.state };
    case 'open-comment':
      return { text: point.answered ? 'Beantwortet, wartet auf dich' : 'Wartet auf den Agenten', detail: point.state };
    case 'unlinked':
      return { text: 'Kein App-Code verknüpft', detail: 'implements' };
    case 'missing-motion':
      return { text: `${point.from} → ${point.to}`, detail: 'motion' };
  }
};

/** The points of a part grouped by kind, in the order `design check` lists them. */
export const groupsOf = ({ points }: PartOpenPoints): PointGroup[] =>
  KINDS.flatMap(({ kind, ...rest }) => {
    const lines = points.filter((point) => point.kind === kind).map(lineOf);
    return lines.length > 0 ? [{ kind, ...rest, lines }] : [];
  });

/** The first `max` lines and a "+N weitere" line for the rest, as the check collapses a long kind. */
export const collapsed = (lines: PointLine[], max: number): { shown: PointLine[]; more: number } => ({
  shown: lines.slice(0, max),
  more: Math.max(0, lines.length - max),
});

export const checkIcon = (size = 16) => icon('check', { size, cls: 'flex-none text-accent-text' });

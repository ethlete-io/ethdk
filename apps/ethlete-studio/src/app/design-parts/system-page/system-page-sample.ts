import { PartTreeLayer } from '../part-tree/part-tree.component';
import { AgentProgress, BuildBlocker, BuildReadyStatus } from './build-ready-footer.component';

export type OpenPointIcon = 'grid' | 'warning' | 'comment' | 'error' | 'flow';

export type OpenPointGroup = { icon: OpenPointIcon; lines: { text: string; detail: string }[] };

export type PartException = { rule: string; reason: string; reopened: boolean };

export const PART_EXCEPTIONS_SAMPLE: PartException[] = [
  { rule: 'filled/UNBOUND-INPUT', reason: 'Das Label kommt im Harness aus einem Beispieltext.', reopened: false },
  {
    rule: 'outline/CONTRAST',
    reason: 'Die Kontur liegt bewusst unter 3:1, der Text trägt den Kontrast.',
    reopened: true,
  },
];

export const SYSTEM_LAYERS: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [] },
  { title: 'Elements', open: false, parts: [] },
  {
    title: 'Components',
    open: true,
    parts: [{ name: 'button', leaf: true, selected: true }, { name: 'form-field' }, { name: 'select', warns: true }],
  },
  { title: 'Pages', open: false, parts: [] },
];

export const MANY_STATES_LAYERS: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [] },
  {
    title: 'Components',
    open: true,
    parts: [
      { name: 'button', leaf: true },
      { name: 'form-field' },
      { name: 'select', warns: true },
      { name: 'tree-row', selected: true, states: [{ name: 'grid' }, { name: 'tree' }] },
    ],
  },
  { title: 'Elements', open: false, parts: [] },
  { title: 'Pages', open: false, parts: [] },
];

const MOTION_STATES = ['filled', 'outline', 'tonal', 'hover', 'active', 'focus-visible', 'disabled'];

export const OPEN_POINTS_SAMPLE: OpenPointGroup[] = [
  { icon: 'grid', lines: [{ text: 'Keine Controls deklariert', detail: 'controls' }] },
  { icon: 'warning', lines: [{ text: 'label liegt unter der Kontrastregel', detail: 'tonal' }] },
  {
    icon: 'comment',
    lines: [
      { text: 'Wartet auf den Agenten', detail: 'outline' },
      { text: 'Beantwortet, wartet auf dich', detail: 'filled' },
    ],
  },
  { icon: 'error', lines: [{ text: 'Kein App-Code verknüpft', detail: 'implements' }] },
  {
    icon: 'flow',
    lines: MOTION_STATES.flatMap((from) =>
      MOTION_STATES.filter((to) => to !== from).map((to) => ({ text: `${from} → ${to}`, detail: 'motion' })),
    ),
  },
];

const EMBEDDED_BLOCKER: BuildBlocker = {
  kind: 'embedded',
  text: 'components/badge ist nicht baubereit',
  part: 'components/badge',
};

const manyBlockers = (openCount: number): BuildBlocker[] => [
  { kind: 'open-point', text: `${openCount} offene Punkte und Ausnahmen` },
  EMBEDDED_BLOCKER,
  { kind: 'problem', text: 'APP-SPEC: button.component.spec.ts schlägt fehl' },
  { kind: 'compare', text: 'hover weicht vom Design ab' },
];

export type BuildReadySample = 'one-blocker' | 'checking' | 'direct-edit' | 'ready' | 'blocked';

export const buildReadySampleOf = (sample: BuildReadySample, openCount: number): BuildReadyStatus => {
  switch (sample) {
    case 'checking':
      return { state: 'checking' };
    case 'ready':
      return { state: 'ready' };
    case 'one-blocker':
      return { state: 'blocked', blockers: [EMBEDDED_BLOCKER] };
    case 'direct-edit':
      return {
        state: 'blocked',
        blockers: [{ kind: 'direct-edit', text: 'Bild ohne Sketch geändert' }, ...manyBlockers(openCount)],
      };
    case 'blocked':
      return { state: 'blocked', blockers: manyBlockers(openCount) };
  }
};

export const AGENT_SAMPLES: Record<AgentProgress['state'], AgentProgress> = {
  working: { state: 'working', doing: 'behebt', detail: 'APP-SPEC in button.component.spec.ts' },
  waiting: { state: 'waiting', detail: 'auf deine Antwort im Kommentar zu outline' },
  interrupted: { state: 'interrupted', detail: 'Sitzung beendet, bevor hover fertig war' },
  failed: { state: 'failed', detail: 'tsc meldet 2 Fehler in system.ts' },
};

export const AGENT_ON_READY_PART_SAMPLE: AgentProgress = {
  state: 'working',
  doing: 'zeichnet',
  detail: 'einen Sketch für den Zustand pressed',
};

export type LegacyCall = { slug: string; headline: string; transferred: boolean };

export type ThemeSwitch = { kind: 'surface' | 'color'; names: string[]; current: string };

export type ThemePick = { kind: ThemeSwitch['kind']; name: string };

export const LEGACY_CALL_SAMPLE: LegacyCall = {
  slug: 'timetrack/kerbe/03-narrow-lane',
  headline: 'Schmale Spur für die Wochenansicht',
  transferred: false,
};

export const THEME_SWITCHES_SAMPLE: ThemeSwitch[] = [
  { kind: 'surface', names: ['light', 'dark'], current: 'light' },
  { kind: 'color', names: ['brand', 'danger', 'warning'], current: 'brand' },
];

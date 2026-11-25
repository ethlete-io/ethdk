import { SketchChange } from '../../../host/design';
import { SAMPLE_BAR_HEIGHT, SAMPLE_BAR_STATES, SAMPLE_STEPPER_HEIGHT } from '../../design-harness/sample-product';
import { AgentLogoName } from '../../icons/agent-logos';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { PartTree } from '../part-tree/part-tree.component';
import { InboxComment } from '../inbox/inbox-sample';
import { OpenPointGroup } from '../system-page/system-page-sample';

export type SketchModel = { short: string; id: string; agent: AgentLogoName; when?: string };

export type SketchShot = {
  state: string;
  changed: boolean | null;
  height: number;
  width?: number;
  change?: SketchChange;
  sameAsRest?: boolean;
  /** The states this row folds as drawn like this rest state. */
  restOf?: string[];
  /** The variant does not draw this state; the cell shows the base's. */
  inherited?: true;
};

/** A new part a variant marks as its sub-part; `notRebuild` is the stated difference from the existing part its name matches. */
export type SketchSubPart = { key: string; notRebuild?: { of: string; difference: string } };

export type SketchRow = {
  key: string;
  label?: string;
  note: string;
  subParts?: SketchSubPart[];
  model?: SketchModel;
  drawing?: true;
  width: number;
  sized?: boolean;
  perLine?: number;
  withdrawn?: string;
  shots: SketchShot[];
};

export type SketchWithdrawn = 'hidden' | 'shown';

export type SketchStatus = 'drawing' | 'waiting' | 'paused' | 'not-ready' | 'failed';

export type SketchHold = { until: string; since: string };

export type SketchRound = { value: string; label: string; note?: string };

export type SketchAgentRun = { by: SketchModel; since: string; failure?: string };

export type SketchMergePort = { merged: string[]; since: string };

/** Where on a variant a comment sits: the state's shot, and the point on it in CSS pixels, if any. */
export type SketchCommentPlace = { variant: string; shot: string; point: { x: number; y: number } | null };

export type SketchComment = InboxComment & SketchCommentPlace;

export type SketchCommentDraft = SketchCommentPlace & { author: string; initials: string };

export type SketchConfirm = 'merge' | 'discard';

export type SketchRepick = { discards: string[]; keeps: string[] };

export type SketchPin = {
  variant: string;
  author: string;
  initials: string;
  agent?: AgentLogoName;
  count: number;
  resolved?: boolean;
};

export const SKETCH_CURRENT = 'current';

const STATES = SAMPLE_BAR_STATES;

const OPUS = { short: 'Opus 5.5', id: 'claude-opus-5-5', agent: 'claude' } as const;
const SOL = { short: 'GPT-6.1 Sol', id: 'gpt-6.1-sol', agent: 'codex' } as const;

const shotsOf = (
  changed: string[],
  {
    height = () => SAMPLE_BAR_HEIGHT,
    states = STATES,
  }: { height?: (changed: boolean, state: string) => number; states?: string[] } = {},
): SketchShot[] =>
  states.map((state) => ({
    state,
    changed: changed.includes(state),
    height: height(changed.includes(state), state),
  }));

export const SKETCH_ROWS: SketchRow[] = [
  { key: SKETCH_CURRENT, label: 'Stand', note: 'Gemergter Stand', width: 1440, shots: shotsOf([]) },
  {
    key: 'a',
    label: 'Entwurf 1',
    note: 'Mit gefülltem Korb wird die Suche schmaler, damit der Korb Platz hat; mit leerem Korb bleibt die Leiste wie heute.',
    model: { ...OPUS, when: '02.11. 10:14' },
    width: 1440,
    shots: shotsOf(STATES.filter((state) => state.endsWith('-basket'))),
  },
  {
    key: 'b',
    label: 'Entwurf 2',
    note: 'Leiste 56 px hoch, damit Suche und Korb mehr Luft haben; kostet 8 px Höhe auf jeder Seite.',
    model: { ...SOL, when: '02.11. 10:21' },
    width: 1440,
    shots: shotsOf(STATES, { height: (changed) => (changed ? 56 : SAMPLE_BAR_HEIGHT) }),
  },
  {
    key: 'c',
    label: 'Entwurf 3',
    note: 'Im Checkout fällt die Shop-Navigation weg, Gast und Mitglied sehen die Leiste wie heute.',
    model: { ...OPUS, when: '02.11. 10:30' },
    width: 1440,
    shots: shotsOf(STATES.filter((state) => state.startsWith('checkout'))),
  },
];

export const SKETCH_LOOKS: Record<string, string> = {
  a: '**:data-farn-search:w-55',
  b: '**:data-farn-bar:h-14',
  c: '**:data-farn-nav:invisible',
};

export const SKETCH_DRAWN = 'b';

export const SKETCH_HOLD: SketchHold = { until: 'B34/B36/B38', since: 'seit 12 Min' };

export const SKETCH_AGENT_RUNS: Record<'round' | 'variant' | 'failed', SketchAgentRun> = {
  round: { by: OPUS, since: 'seit 4 Min' },
  variant: { by: SOL, since: 'seit 2 Min' },
  failed: { by: OPUS, since: 'vor 3 Min', failure: 'Runde 2 fehlgeschlagen' },
};

export const SKETCH_MERGE_PORTS: Record<'one' | 'two', SketchMergePort> = {
  one: { merged: ['components/button'], since: 'seit 1 Min' },
  two: { merged: ['components/sketch-status-badge', 'elements/variant-cell'], since: 'seit 1 Min' },
};

export const SKETCH_ROUNDS: SketchRound[] = [{ value: 'round-1', label: 'Runde 1 · Suche und Korb' }];

export const SKETCH_PINS: SketchPin[] = [{ variant: 'a', author: 'human', initials: 'TB', count: 1 }];

const SKETCH_COMPONENTS = ['plant-page', 'shop-bar', 'quantity-stepper@edit', 'quantity-stepper'];

const componentsLayerOf = (selected?: string) => ({
  title: 'Components',
  open: true,
  parts: SKETCH_COMPONENTS.map((name) => (name === selected ? { name, selected: true } : { name })),
});

export const SKETCH_TREE: PartTree = {
  layers: [componentsLayerOf('shop-bar'), { title: 'Pages', open: true, parts: [{ name: 'shop' }] }],
};

const CHIP_STATES = [
  'count',
  'count-hover',
  'count-active',
  'count-focus-visible',
  'add',
  'add-hover',
  'add-active',
  'add-focus-visible',
];

const CHIP_HEIGHT = SAMPLE_STEPPER_HEIGHT;

const chipShotsOf = (changed: string[]) => shotsOf(changed, { height: () => CHIP_HEIGHT, states: CHIP_STATES });

export const SKETCH_WITHDRAWN = {
  key: 'b',
  reason: 'Halbfett macht die Anzahl breiter, der Stepper springt bei zweistelligen Mengen um 4 px',
};

export const SKETCH_NARROW_SAMPLE = {
  part: 'components/quantity-stepper',
  rows: [
    { key: SKETCH_CURRENT, label: 'Stand', note: 'Gemergter Stand', width: 176, shots: chipShotsOf([]) },
    {
      key: 'a',
      label: 'Entwurf 1',
      note: 'Korb-Knopf als Pille, mit Luft zum Zähler.',
      model: { ...OPUS, when: '02.11. 11:02' },
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state === 'add')),
    },
    {
      key: 'b',
      label: 'Entwurf 2',
      note: 'Anzahl in Halbfett, damit die Menge auf einen Blick lesbar ist.',
      model: { ...SOL, when: '02.11. 11:09' },
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state.startsWith('count'))),
    },
  ] satisfies SketchRow[],
  looks: { a: '**:data-farn-add:rounded-full', b: '**:data-farn-count:font-ui-strong' } as Record<string, string>,
  rounds: [{ value: 'round-1', label: 'Runde 1 · Korb-Knopf und Anzahl' }] satisfies SketchRound[],
  tree: {
    layers: [componentsLayerOf('quantity-stepper'), { title: 'Pages', open: true, parts: [{ name: 'shop' }] }],
  } satisfies PartTree,
};

/** A state only variant a of the narrow sample draws, so Current and variant b lack it. */
export const SKETCH_ADDED_STATE = { state: 'add-disabled', in: ['a'], height: CHIP_HEIGHT };

const WIDE_DRAWN_AS = 'count-focus-visible';

/** A state of variant b of the narrow sample measured wider than the stepper. */
export const SKETCH_WIDE_STATE = {
  state: 'count-focus-tooltip',
  key: 'b',
  width: 197,
  height: CHIP_HEIGHT,
};

/** The stepper state the harness draws for a narrow sample state no stepper state names. */
export const SKETCH_DRAWN_AS: Record<string, string> = {
  [SKETCH_WIDE_STATE.state]: WIDE_DRAWN_AS,
};

const [CURRENT_ROW, VARIANT_A_ROW, VARIANT_B_ROW] = SKETCH_NARROW_SAMPLE.rows as [SketchRow, SketchRow, SketchRow];

export const SKETCH_NEIGHBOURS_SAMPLE = {
  ...SKETCH_NARROW_SAMPLE,
  rows: [
    CURRENT_ROW,
    {
      ...VARIANT_A_ROW,
      note: 'Die Anzahl färbt sich beim Überfahren des Zählers.',
      shots: chipShotsOf(['count-hover']),
    },
    {
      ...VARIANT_B_ROW,
      note: 'Der Korb-Knopf wird beim Drücken und beim Fokus zur Pille.',
      shots: chipShotsOf(['add-active', 'add-focus-visible']),
    },
  ] satisfies SketchRow[],
  looks: {
    a: '**:data-farn-count:text-et-theme',
    b: '**:data-farn-add:rounded-full',
  } as Record<string, string>,
  rounds: [{ value: 'round-3', label: 'Runde 3 · Nachbarschaft einer Änderung' }] satisfies SketchRound[],
  round: 'round-3',
};

export const SKETCH_EDIT_SAMPLE = {
  ...SKETCH_NARROW_SAMPLE,
  part: 'components/quantity-stepper@edit',
  rows: [
    { key: 'old', note: 'Stand vor der direkten Änderung', width: 176, shots: chipShotsOf([]) },
    {
      key: 'new',
      note: 'Direkte Änderung: Anzahl in Halbfett.',
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state.startsWith('count'))),
    },
  ] satisfies SketchRow[],
  looks: {} as Record<string, string>,
  rounds: [{ value: 'edit', label: 'Direkte Änderung' }] satisfies SketchRound[],
  round: 'edit',
  tree: {
    layers: [componentsLayerOf('quantity-stepper@edit'), { title: 'Pages', open: true, parts: [{ name: 'shop' }] }],
  } satisfies PartTree,
};

export const SKETCH_MANY_STATES = Array.from(
  { length: 30 },
  (_, index) => `state-${String(index + 1).padStart(2, '0')}`,
);

const MANY_WIDTH = 1440;

const manyShotsOf = (changed: string[]) => shotsOf(changed, { height: () => 900, states: SKETCH_MANY_STATES });

export const SKETCH_MANY_SAMPLE = {
  part: 'components/plant-page',
  rows: [
    { key: SKETCH_CURRENT, label: 'Stand', note: 'Gemergter Stand', width: MANY_WIDTH, shots: manyShotsOf([]) },
    {
      key: 'a',
      label: 'Entwurf 1',
      note: 'Gerade Zustände ändern sich.',
      model: { ...OPUS, when: '02.11. 11:02' },
      width: MANY_WIDTH,
      shots: manyShotsOf(SKETCH_MANY_STATES.filter((_, index) => index % 2 === 1)),
    },
    {
      key: 'b',
      label: 'Entwurf 2',
      note: 'Ungerade Zustände ändern sich.',
      model: { ...SOL, when: '02.11. 11:09' },
      width: MANY_WIDTH,
      shots: manyShotsOf(SKETCH_MANY_STATES.filter((_, index) => index % 2 === 0)),
    },
  ] satisfies SketchRow[],
  looks: { a: '[&_div]:text-et-theme', b: '[&_div]:font-ui-strong' } as Record<string, string>,
  rounds: [{ value: 'round-1', label: 'Runde 1 · Viele Zustände' }] satisfies SketchRound[],
  tree: {
    layers: [componentsLayerOf('plant-page'), { title: 'Pages', open: true, parts: [{ name: 'shop' }] }],
  } satisfies PartTree,
};

export const SKETCH_PHONE_STATES = ['phone-01', 'phone-02', 'phone-03'];

export const SKETCH_PHONE_SAMPLE = {
  part: 'components/plant-page',
  rows: [
    {
      key: SKETCH_CURRENT,
      label: 'Stand',
      note: 'Gemergter Stand',
      width: 390,
      shots: shotsOf([], { height: () => 900, states: SKETCH_PHONE_STATES }),
    },
  ] satisfies SketchRow[],
  looks: {} as Record<string, string>,
  rounds: [{ value: 'round-1', label: 'Runde 1 · Schmale Seite' }] satisfies SketchRound[],
  tree: SKETCH_MANY_SAMPLE.tree,
};

const MULTI_TARGETS = ['components/badge', 'components/sketch-status-badge', 'elements/variant-cell'];

const MANY_TARGETS = [
  ...MULTI_TARGETS,
  'components/chip',
  'components/tree-row',
  'elements/part-tree',
  'pages/sketches',
  'pages/merge',
];

/** A sketch with several parts on the narrow sample: its targets under it in the tree. */
export const sketchMultiSampleOf = (count: 'three' | 'many') => ({
  tree: {
    sketches: {
      open: true,
      items: [
        {
          part: 'badge',
          name: 'kopf-tags',
          status: 'ready',
          selected: true,
          nested: (count === 'many' ? MANY_TARGETS : MULTI_TARGETS).map((name) => ({ name })),
        },
      ],
    },
    layers: SKETCH_NARROW_SAMPLE.tree.layers.map((layer) => ({
      ...layer,
      parts: layer.parts.map(({ name }) => ({ name })),
    })),
  } satisfies PartTree,
});

export const SKETCH_POINTS_SAMPLE: OpenPointGroup[] = [
  { icon: 'grid', lines: [{ text: SYSTEM_LABELS.sketchPicked, detail: 'sketch' }] },
];

const SCREEN = { width: 1440, height: 900 };

const SCREEN_CHANGES: { states: string[]; change: SketchChange }[] = [
  {
    states: [
      'comparing-narrow',
      'narrow-part',
      'narrow-below-fit',
      'narrow-far-out',
      'unchanged-open',
      'all-unchanged',
      'withdrawn-hidden',
      'withdrawn-shown',
      'agent-failed',
      'question-only',
    ],
    change: {
      ...SCREEN,
      box: { x: 842, y: 371, width: 575, height: 45 },
      pixels: 1358,
      regions: 3,
      areas: [842, 1041, 1240].map((x) => ({ x, y: 371, width: 176, height: 45 })),
    },
  },
  {
    states: ['port-after-merge'],
    change: { ...SCREEN, box: { x: 300, y: 92, width: 420, height: 24 }, pixels: 2140, regions: 1 },
  },
];

const SCREEN_UNCHANGED = [
  'page-sketch',
  'page-100',
  'zoomed-page',
  'drawing',
  'paused',
  'paused-reason',
  'new-part',
  'sticky-names',
  'comparing',
  'below-fit',
  'far-out',
  'unchanged',
  'unchanged-matrix',
  'unchanged-matrix-open',
  'folded',
];

const screenShotsOf = (changed: boolean): SketchShot[] => [
  ...SCREEN_CHANGES.flatMap(({ states, change }) =>
    states.map((state) => ({ state, changed, height: SCREEN.height, ...(changed ? { change } : {}) })),
  ),
  ...SCREEN_UNCHANGED.map((state) => ({ state, changed: false, height: SCREEN.height })),
];

export const SKETCH_SCREEN_SAMPLE = {
  part: 'pages/plants',
  rows: [
    { key: SKETCH_CURRENT, label: 'Stand', note: 'Gemergter Stand', width: SCREEN.width, shots: screenShotsOf(false) },
    {
      key: 'a',
      label: 'Entwurf 1',
      note: 'Versandhinweis als Zeile unter dem Kopf; die Topfgrößen tragen die Pillenform.',
      model: { ...OPUS, when: '04.11. 09:12' },
      width: SCREEN.width,
      shots: screenShotsOf(true),
    },
  ] satisfies SketchRow[],
  rounds: [{ value: 'round-2', label: 'Runde 2 · Port nach dem Merge' }] satisfies SketchRound[],
  round: 'round-2',
  tree: {
    layers: [
      componentsLayerOf(),
      {
        title: 'Pages',
        open: true,
        parts: [{ name: 'shop' }, { name: 'plants', selected: true }],
      },
    ],
  } satisfies PartTree,
  wholeScreen: SCREEN_CHANGES[0]?.states[0] ?? '',
};

export const SKETCH_COMMENTS_SAMPLE: SketchComment[] = [
  {
    id: 'sk-c1',
    variant: 'a',
    shot: 'count',
    point: { x: 188.9123, y: 6.3613 },
    author: 'human',
    initials: 'H',
    when: 'vor 20 Min',
    part: 'Entwurf 1',
    state: 'add-hover',
    text: 'Die Pille wirkt hier zu eng, sie klebt am Zähler.',
    replies: 1,
  },
  {
    id: 'sk-c2',
    variant: 'b',
    shot: 'count-active',
    point: { x: 146.6426, y: 44.5806 },
    author: 'Claude',
    initials: 'C',
    agent: 'claude',
    when: 'vor 4 Min',
    part: 'Entwurf 2',
    state: 'count-hover',
    text: 'Halbfett liest sich besser. Soll Entwurf 1 die Anzahl auch so bekommen?',
    replies: 2,
    unread: true,
  },
];

export const SKETCH_COMMENT_DRAFT_SAMPLE: SketchCommentDraft = {
  variant: 'b',
  shot: 'count',
  point: { x: 316.1871, y: 22.4194 },
  author: 'human',
  initials: 'H',
};

export const SKETCH_COMMENT_DRAFT_TEXT = 'Der Korb-Knopf braucht hier mehr Luft zur Anzahl.';

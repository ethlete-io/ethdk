import { SketchChange } from '../../../host/design';
import { AgentLogoName } from '../../icons/agent-logos';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { PartTree } from '../part-tree/part-tree.component';
import { OpenPointGroup } from '../system-page/system-page-sample';

export type SketchModel = { short: string; id: string; agent: AgentLogoName; when?: string };

export type SketchShot = { state: string; changed: boolean | null; height: number; change?: SketchChange };

export type SketchRow = {
  key: string;
  label?: string;
  note: string;
  model?: SketchModel;
  width: number;
  sized?: boolean;
  withdrawn?: string;
  shots: SketchShot[];
};

export type SketchWithdrawn = 'hidden' | 'shown';

export type SketchStatus = 'drawing' | 'waiting' | 'picked' | 'paused' | 'idle';

export type SketchHold = { until: string; by: SketchModel; since: string };

export type SketchIdle = { by: string; since: string };

export type SketchRound = { value: string; label: string; note?: string };

export type SketchPin = {
  variant: string;
  author: string;
  initials: string;
  agent?: AgentLogoName;
  count: number;
};

export type SketchTitleBar = {
  os: 'linux' | 'windows' | 'macos';
  right: ('minimize' | 'maximize' | 'close')[];
  update: boolean;
};

export const SKETCH_CURRENT = 'current';

const STATES = ['linux-close', 'linux-close-update', 'windows', 'windows-update', 'macos', 'macos-update'];

const OPUS = { short: 'Opus 5.5', id: 'claude-opus-5-5', agent: 'claude' } as const;
const SOL = { short: 'GPT-6.1 Sol', id: 'gpt-6.1-sol', agent: 'codex' } as const;

const shotsOf = (
  changed: string[],
  { height = () => 32, states = STATES }: { height?: (changed: boolean) => number; states?: string[] } = {},
): SketchShot[] =>
  states.map((state) => ({ state, changed: changed.includes(state), height: height(changed.includes(state)) }));

export const SKETCH_ROWS: SketchRow[] = [
  { key: SKETCH_CURRENT, label: 'Stand', note: 'Gemergter Stand', width: 1440, shots: shotsOf([]) },
  {
    key: 'a',
    label: 'Entwurf 1',
    note: 'Update als schmaler Button direkt neben der Suche, die Suche wird dafür schmaler; ohne Update bleibt die Leiste wie heute.',
    model: { ...OPUS, when: '02.11. 10:14' },
    width: 1440,
    shots: shotsOf(['linux-close-update', 'windows-update', 'macos-update']),
  },
  {
    key: 'b',
    label: 'Entwurf 2',
    note: 'Leiste 40 px hoch, damit Suche und Fensterknöpfe mehr Luft haben; kostet 8 px Höhe in jeder Ansicht.',
    model: { ...SOL, when: '02.11. 10:21' },
    width: 1440,
    shots: shotsOf(STATES, { height: (changed) => (changed ? 40 : 32) }),
  },
  {
    key: 'c',
    label: 'Entwurf 3',
    note: 'Unter macOS rückt die Suche nach links an die Ampel, Linux und Windows bleiben gleich.',
    model: { ...OPUS, when: '02.11. 10:30' },
    width: 1440,
    shots: shotsOf(['macos', 'macos-update']),
  },
];

type TitleBarLayout = Omit<SketchTitleBar, 'update'>;

const LINUX_CLOSE: TitleBarLayout = { os: 'linux', right: ['close'] };
const WINDOWS: TitleBarLayout = { os: 'windows', right: ['minimize', 'maximize', 'close'] };
const MACOS: TitleBarLayout = { os: 'macos', right: [] };

export const SKETCH_TITLE_BARS: Record<string, SketchTitleBar> = {
  'linux-close': { ...LINUX_CLOSE, update: false },
  'linux-close-update': { ...LINUX_CLOSE, update: true },
  windows: { ...WINDOWS, update: false },
  'windows-update': { ...WINDOWS, update: true },
  macos: { ...MACOS, update: false },
  'macos-update': { ...MACOS, update: true },
};

export const SKETCH_LOOKS: Record<string, string> = {
  a: '[&_.w-2xl]:w-55',
  b: '[&_.st-title-bar]:h-10',
  c: '[&_.st-title-bar]:grid-cols-[auto_1fr_auto]',
};

export const SKETCH_DRAWN = 'b';

export const SKETCH_HOLD: SketchHold = { until: 'B34/B36/B38', by: OPUS, since: 'seit 12 Min' };

export const SKETCH_IDLE: SketchIdle = { by: 'Opus 5.5', since: 'seit 25 Min' };

export const SKETCH_ROUNDS: SketchRound[] = [{ value: 'round-1', label: 'Runde 1 · Suche und Update' }];

export const SKETCH_PINS: SketchPin[] = [{ variant: 'a', author: 'human', initials: 'TB', count: 1 }];

const SKETCH_COMPONENTS = ['title-bar', 'zoom-chip@edit', 'zoom-chip'];

const componentsLayerOf = (selected?: string) => ({
  title: 'Components',
  open: true,
  parts: SKETCH_COMPONENTS.map((name) => (name === selected ? { name, selected: true } : { name })),
});

export const SKETCH_TREE: PartTree = {
  layers: [componentsLayerOf('title-bar'), { title: 'Pages', open: true, parts: [{ name: 'system' }] }],
};

const CHIP_STATES = [
  'reset',
  'reset-hover',
  'reset-active',
  'reset-focus-visible',
  'fit',
  'fit-hover',
  'fit-active',
  'fit-focus-visible',
];

const CHIP_HEIGHT = 30;

const chipShotsOf = (changed: string[]) => shotsOf(changed, { height: () => CHIP_HEIGHT, states: CHIP_STATES });

export const SKETCH_WITHDRAWN = {
  key: 'b',
  reason: 'Halbfett macht die Prozentzahl breiter, der Chip springt beim Zoomen um 4 px',
};

export const SKETCH_NARROW_SAMPLE = {
  part: 'components/zoom-chip',
  rows: [
    { key: SKETCH_CURRENT, label: 'Stand', note: 'Gemergter Stand', width: 176, shots: chipShotsOf([]) },
    {
      key: 'a',
      label: 'Entwurf 1',
      note: 'Chip als Pille, die Knöpfe rücken enger zusammen.',
      model: { ...OPUS, when: '02.11. 11:02' },
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state === 'fit')),
    },
    {
      key: 'b',
      label: 'Entwurf 2',
      note: 'Prozentzahl in Halbfett, damit der Zoom auf einen Blick lesbar ist.',
      model: { ...SOL, when: '02.11. 11:09' },
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state.startsWith('reset'))),
    },
  ] satisfies SketchRow[],
  looks: { a: '**:data-canvas-zoom:rounded-full', b: '[&_[data-camera-reset]_button]:font-ui-strong' } as Record<
    string,
    string
  >,
  rounds: [{ value: 'round-1', label: 'Runde 1 · Reset control: SDK button or own part' }] satisfies SketchRound[],
  tree: {
    layers: [componentsLayerOf('zoom-chip'), { title: 'Pages', open: true, parts: [{ name: 'system' }] }],
  } satisfies PartTree,
};

export const SKETCH_EDIT_SAMPLE = {
  ...SKETCH_NARROW_SAMPLE,
  part: 'components/zoom-chip@edit',
  rows: [
    { key: 'old', note: 'Stand vor der direkten Änderung', width: 176, shots: chipShotsOf([]) },
    {
      key: 'new',
      note: 'Direkte Änderung: Prozentzahl in Halbfett.',
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state.startsWith('reset'))),
    },
  ] satisfies SketchRow[],
  looks: {} as Record<string, string>,
  rounds: [{ value: 'edit', label: 'Direkte Änderung' }] satisfies SketchRound[],
  round: 'edit',
  tree: {
    layers: [componentsLayerOf('zoom-chip@edit'), { title: 'Pages', open: true, parts: [{ name: 'system' }] }],
  } satisfies PartTree,
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

/** A sketch with several parts on the narrow sample: its round title as head, its targets under it in the tree. */
export const sketchMultiSampleOf = (count: 'three' | 'many') => ({
  heading: 'Kopf-Tags in einem Stil',
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
  { icon: 'grid', lines: [{ text: STUDIO_LABELS.system.sketchPicked, detail: 'sketch' }] },
  {
    icon: 'error',
    lines: [
      { text: STUDIO_LABELS.system.sketchProblem('UTILITY-CSS'), detail: 'b' },
      { text: STUDIO_LABELS.system.sketchProblem('UTILITY-CSS'), detail: 'b' },
    ],
  },
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
      'agent-round',
      'agent-variant',
      'agent-failed',
      'question-only',
    ],
    change: { ...SCREEN, box: { x: 842, y: 371, width: 575, height: 45 }, pixels: 1358, regions: 3 },
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
  'idle',
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
  part: 'pages/sketches',
  rows: [
    { key: SKETCH_CURRENT, label: 'Stand', note: 'Gemergter Stand', width: SCREEN.width, shots: screenShotsOf(false) },
    {
      key: 'a',
      label: 'Entwurf 1',
      note: 'Port nach dem Merge als Zeile unter dem Kopf; die Zellen der Probe tragen die Pillenform.',
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
        parts: [{ name: 'system' }, { name: 'sketches', selected: true }],
      },
    ],
  } satisfies PartTree,
  wholeScreen: SCREEN_CHANGES[0]?.states[0] ?? '',
};

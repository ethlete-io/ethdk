import { AgentLogoName } from '../../icons/agent-logos';
import { PartTreeLayer } from '../part-tree/part-tree.component';

export type SketchModel = { short: string; id: string; agent: AgentLogoName; when?: string };

export type SketchShot = { state: string; changed: boolean | null; height: number };

export type SketchRow = {
  key: string;
  note: string;
  model?: SketchModel;
  width: number;
  sized?: boolean;
  shots: SketchShot[];
};

export type SketchStatus = 'drawing' | 'waiting' | 'paused' | 'idle';

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
  { key: SKETCH_CURRENT, note: 'Gemergter Stand', width: 1440, shots: shotsOf([]) },
  {
    key: 'a',
    note: 'Update als schmaler Button direkt neben der Suche, die Suche wird dafür schmaler; ohne Update bleibt die Leiste wie heute.',
    model: { ...OPUS, when: '02.11. 10:14' },
    width: 1440,
    shots: shotsOf(['linux-close-update', 'windows-update', 'macos-update']),
  },
  {
    key: 'b',
    note: 'Leiste 40 px hoch, damit Suche und Fensterknöpfe mehr Luft haben; kostet 8 px Höhe in jeder Ansicht.',
    model: { ...SOL, when: '02.11. 10:21' },
    width: 1440,
    shots: shotsOf(STATES, { height: (changed) => (changed ? 40 : 32) }),
  },
  {
    key: 'c',
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

export const SKETCH_PINS: SketchPin[] = [{ variant: 'a', author: 'Tom Bornholdt', initials: 'TB', count: 1 }];

export const SKETCH_TREE: PartTreeLayer[] = [
  {
    title: 'Components',
    open: true,
    parts: [
      { name: 'title-bar', leaf: true, selected: true },
      { name: 'zoom-chip', leaf: true },
    ],
  },
  { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true }] },
];

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

export const SKETCH_NARROW_SAMPLE = {
  part: 'components/zoom-chip',
  rows: [
    { key: SKETCH_CURRENT, note: 'Gemergter Stand', width: 176, shots: chipShotsOf([]) },
    {
      key: 'a',
      note: 'Chip als Pille, die Knöpfe rücken enger zusammen.',
      model: { ...OPUS, when: '02.11. 11:02' },
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state === 'fit')),
    },
    {
      key: 'b',
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
  tree: [
    {
      title: 'Components',
      open: true,
      parts: [
        { name: 'title-bar', leaf: true },
        { name: 'zoom-chip', leaf: true, selected: true },
      ],
    },
    { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true }] },
  ] satisfies PartTreeLayer[],
};

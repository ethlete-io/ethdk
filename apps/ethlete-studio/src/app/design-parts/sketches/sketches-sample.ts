import { AgentLogoName } from '../../icons/agent-logos';
import { PartTreeLayer } from '../part-tree/part-tree.component';

export type SketchModel = { short: string; id: string; agent: AgentLogoName; when?: string };

export type SketchShot = { state: string; changed: boolean | null; height: number };

export type SketchRow = {
  key: string;
  note: string;
  model?: SketchModel;
  width: number;
  shots: SketchShot[];
};

export type SketchStatus = 'drawing' | 'waiting' | 'paused' | 'idle';

export type SketchHold = { until: string; by: SketchModel; since: string };

export type SketchIdle = { by: string; since: string };

export type SketchRound = { value: string; label: string };

export type SketchPin = {
  variant: string;
  author: string;
  initials: string;
  agent?: AgentLogoName;
  count: number;
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
      shots: chipShotsOf(CHIP_STATES.filter((state) => state.startsWith('fit'))),
    },
    {
      key: 'b',
      note: 'Prozentzahl in Halbfett, damit der Zoom auf einen Blick lesbar ist.',
      model: { ...SOL, when: '02.11. 11:09' },
      width: 176,
      shots: chipShotsOf(CHIP_STATES.filter((state) => state.startsWith('reset'))),
    },
  ] satisfies SketchRow[],
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

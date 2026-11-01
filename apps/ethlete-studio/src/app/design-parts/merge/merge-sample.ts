export type MergeSide = 'now' | 'after';

export type MergeRect = { x: number; y: number; width: number; height: number };

export type MergeRow = {
  part: string;
  state: string;
  instances: number;
  width: number;
  height: number;
  now: string;
  after: string;
  missing?: MergeSide;
  crop?: Record<MergeSide, MergeRect | null>;
};

export type MergeTarget = { part: string; name: string; variant: string; note: string };

export type MergeUnchanged = { part: string; states: string[] };

const frameSrc = (part: string, state: string) => `/frame.html?product=studio&part=${part}&state=${state}`;

export const MERGE_SAMPLE_TARGET: MergeTarget = {
  part: 'components/button',
  name: 'button',
  variant: 'b',
  note: 'Pill-Radius in jeder Größe',
};

export const MERGE_SAMPLE_CHANGED: MergeRow[] = [
  {
    part: 'elements/canvas-frames',
    state: 'default',
    instances: 18,
    width: 1440,
    height: 560,
    now: frameSrc('elements/canvas-frames', 'default'),
    after: frameSrc('elements/canvas-frames', 'default'),
  },
  {
    part: 'pages/system',
    state: 'empty',
    instances: 1,
    width: 1440,
    height: 900,
    now: frameSrc('pages/system', 'empty'),
    after: frameSrc('pages/system', 'empty'),
  },
  {
    part: 'pages/system',
    state: 'onboarding',
    instances: 1,
    width: 1440,
    height: 900,
    now: '',
    after: frameSrc('pages/system', 'empty'),
    missing: 'now',
  },
];

export const MERGE_SAMPLE_UNCHANGED: MergeUnchanged = { part: 'pages/inbox', states: ['all', 'none'] };

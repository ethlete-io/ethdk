import { Band, DayLaneFixture, DayStory, FULL_DAY_LANES, FULL_DAY_STORIES } from '../../../kerbe';

export const HOUR_REM = 8;
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 19;
export const GUTTER_REM = 5;
export const LANE_MIN_REM = 14;
export const STRIP_ROW_REM = 2.4;
export const NOW_MINUTES = 16 * 60 + 20;

export const STORIES: DayStory[] = FULL_DAY_STORIES;

/** How the break says it is a break. The first three write the word; the rest draw a mark. */
export type BreakLabelAt =
  | 'ground'
  | 'idle-lane'
  | 'gutter'
  | 'notch'
  | 'glyph'
  | 'bare'
  | 'hatch-notch'
  | 'hatch-rules'
  | 'hatch-day'
  | 'block-gutter'
  | 'heavy-rules'
  | 'hatch-loud'
  | 'named'
  | 'named-block'
  | 'named-hatch'
  | 'named-turned'
  | 'sign-pause'
  | 'sign-cup'
  | 'sign-none'
  | 'sign-plate'
  | 'sign-cut'
  | 'sign-bold'
  | 'sign-shrink'
  | 'sign-flat';

/**
 * Three agent runs across the 12:15 break, one per lane, so no lane is idle through it. Agents
 * reach the machine while nobody is at it, and they do not take turns. The 15:30 break keeps
 * every lane idle, so both ends of the case read in one picture.
 */
export const AGENT_BANDS: Record<string, Band> = {
  'lane:fut-frontend': {
    id: 'agent-fut',
    kind: 'work',
    ask: 'a glance',
    from: '12:30',
    minutes: 45,
    label: 'ET-772',
    detail: 'Agent · ran while away',
  },
  'lane:ethlete-sdk': {
    id: 'agent-sdk',
    kind: 'work',
    ask: 'an answer',
    from: '12:15',
    minutes: 45,
    label: 'ET-780',
    detail: 'Agent · fix(query): Drop the stale token',
  },
  'lane:calls': {
    id: 'agent-calls',
    kind: 'background',
    ask: 'nothing',
    from: '12:00',
    minutes: 30,
    label: 'in the background',
  },
};

export type Laid = { band: Band; topRem: number; inlineOffset: number; inlineSize: number };

export type LaidLane = { key: string; label: string; widthRem: number; laid: Laid[] };

export type BreakMark = {
  id: string;
  minutes: number;
  topRem: number;
  heightRem: number;
  busyLanes: string[];
  /** A break too short to hold the sign at full size. */
  short: boolean;
  /** The leftmost lane with nothing across this break, or `null` when every lane was busy. */
  idleLaneKey: string | null;
};

export type LaidHour = { hour: number; topRem: number };

const startOf = (band: Band) => {
  const [h = 0, m = 0] = band.from.split(':').map(Number);

  return h * 60 + m;
};

const BREAK_SOURCE = FULL_DAY_LANES.filter((lane) => lane.narrow)[0];
const BREAK_BANDS = BREAK_SOURCE?.bands ?? [];

const WORK_SOURCE: DayLaneFixture[] = FULL_DAY_LANES.filter((lane) => !lane.narrow).map((lane) => {
  const agent = AGENT_BANDS[lane.key];

  return agent ? { ...lane, bands: [...lane.bands, agent] } : lane;
});

type Packed = { band: Band; start: number; inlineOffset: number; inlineSize: number };

/** Packs a lane into the fewest overlap-free columns, the way `packLane` does in `day-review/lanes.ts`. */
const packLane = (bands: Band[]): Packed[] => {
  const sorted = [...bands].sort((a, b) => startOf(a) - startOf(b));
  const packed: Packed[] = [];
  let cluster: { band: Band; column: number }[] = [];
  let endsPerColumn: number[] = [];

  const flush = () => {
    if (!cluster.length) return;

    const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1));

    for (const entry of cluster) {
      packed.push({
        band: entry.band,
        start: startOf(entry.band),
        inlineOffset: (entry.column / columns) * 100,
        inlineSize: 100 / columns,
      });
    }

    cluster = [];
    endsPerColumn = [];
  };

  for (const band of sorted) {
    const start = startOf(band);
    const end = start + band.minutes;

    if (endsPerColumn.length && start >= Math.max(...endsPerColumn)) flush();

    let column = endsPerColumn.findIndex((taken) => taken <= start);

    if (column === -1) column = endsPerColumn.length;

    endsPerColumn[column] = end;
    cluster.push({ band, column });
  }

  flush();

  return packed;
};

const toRem = (minutes: number) => ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_REM;

export const HOURS: LaidHour[] = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => ({
  hour: DAY_START_HOUR + i,
  topRem: i * HOUR_REM,
}));

export const LANES: LaidLane[] = WORK_SOURCE.map((lane) => ({
  key: lane.key,
  label: lane.label,
  widthRem: LANE_MIN_REM,
  laid: packLane(lane.bands).map((entry) => ({
    band: entry.band,
    topRem: toRem(entry.start),
    inlineOffset: entry.inlineOffset,
    inlineSize: entry.inlineSize,
  })),
}));

export const MARKS: BreakMark[] = BREAK_BANDS.map((band) => {
  const start = startOf(band);
  const end = start + band.minutes;
  const busyLanes = WORK_SOURCE.filter((lane) =>
    lane.bands.some((other) => startOf(other) < end && startOf(other) + other.minutes > start),
  ).map((lane) => lane.key);

  return {
    id: band.id,
    minutes: band.minutes,
    topRem: toRem(start),
    heightRem: toRem(end) - toRem(start),
    busyLanes,
    short: toRem(end) - toRem(start) < 3,
    idleLaneKey: WORK_SOURCE.map((lane) => lane.key).find((key) => !busyLanes.includes(key)) ?? null,
  };
});

export const DAY_HEIGHT_REM = toRem(DAY_END_HOUR * 60);
export const NOW_REM = toRem(NOW_MINUTES);

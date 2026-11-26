import { Band, BandNarrow, DayStory, FULL_DAY_LANES, FULL_DAY_STORIES } from '../../shared/kerbe';

export const HOUR_REM = 8;
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 19;
export const GUTTER_REM = 5;
export const LANE_MIN_REM = 14;
export const BREAK_LANE_REM = 6;
export const STRIP_ROW_REM = 2.4;
export const NOW_MINUTES = 16 * 60 + 20;

export const STORIES: DayStory[] = FULL_DAY_STORIES;

/** Where a break is drawn. `lane` is what the app does today. */
export type BreakMode = 'lane' | 'rule' | 'gutter' | 'collapse';

export type Laid = { band: Band; topRem: number; inlineOffset: number; inlineSize: number };

export type LaidLane = {
  key: string;
  label: string;
  narrow: boolean;
  widthRem: number;
  narrowMode: BandNarrow;
  laid: Laid[];
};

export type BreakMark = { id: string; label: string; minutes: number; topRem: number; heightRem: number };

export type LaidHour = { hour: number; topRem: number };

export type LaidDay = {
  lanes: LaidLane[];
  marks: BreakMark[];
  hours: LaidHour[];
  heightRem: number;
  nowRem: number;
};

const startOf = (band: Band) => {
  const [h = 0, m = 0] = band.from.split(':').map(Number);

  return h * 60 + m;
};

const BREAK_SOURCE = FULL_DAY_LANES.filter((lane) => lane.narrow)[0];
const WORK_SOURCE = FULL_DAY_LANES.filter((lane) => !lane.narrow);
const BREAK_BANDS = BREAK_SOURCE?.bands ?? [];

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

const linearRem = (minutes: number) => ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_REM;

const SPANS = BREAK_BANDS.map((band) => ({ start: startOf(band), end: startOf(band) + band.minutes }));

const collapsedRem = (minutes: number) => {
  let shift = 0;

  for (const span of SPANS) {
    if (span.end <= minutes) shift += span.end - span.start;
    else if (span.start < minutes) shift += minutes - span.start;
  }

  return linearRem(minutes) - (shift / 60) * HOUR_REM;
};

export const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

const buildDay = (mode: BreakMode): LaidDay => {
  const toRem = mode === 'collapse' ? collapsedRem : linearRem;

  const workLanes: LaidLane[] = WORK_SOURCE.map((lane) => ({
    key: lane.key,
    label: lane.label,
    narrow: false,
    widthRem: LANE_MIN_REM,
    narrowMode: 'drop-time',
    laid: packLane(lane.bands).map((entry) => ({
      band: entry.band,
      topRem: toRem(entry.start),
      inlineOffset: entry.inlineOffset,
      inlineSize: entry.inlineSize,
    })),
  }));

  if (mode === 'lane') {
    const breakLane: LaidLane = {
      key: BREAK_SOURCE?.key ?? 'lane:break',
      label: BREAK_SOURCE?.label ?? 'Break',
      narrow: true,
      widthRem: BREAK_LANE_REM,
      narrowMode: 'drop-label',
      laid: packLane(BREAK_BANDS).map((entry) => ({
        band: entry.band,
        topRem: toRem(entry.start),
        inlineOffset: entry.inlineOffset,
        inlineSize: entry.inlineSize,
      })),
    };

    return {
      lanes: [breakLane, ...workLanes],
      marks: [],
      hours: HOURS.map((hour) => ({ hour, topRem: toRem(hour * 60) })),
      heightRem: toRem(DAY_END_HOUR * 60),
      nowRem: toRem(NOW_MINUTES),
    };
  }

  const marks: BreakMark[] = BREAK_BANDS.map((band) => {
    const start = startOf(band);

    return {
      id: band.id,
      label: band.label,
      minutes: band.minutes,
      topRem: toRem(start),
      heightRem: toRem(start + band.minutes) - toRem(start),
    };
  });

  const hidden = (hour: number) => SPANS.some((span) => hour * 60 > span.start && hour * 60 < span.end);

  return {
    lanes: workLanes,
    marks,
    hours: HOURS.filter((hour) => mode !== 'collapse' || !hidden(hour)).map((hour) => ({
      hour,
      topRem: toRem(hour * 60),
    })),
    heightRem: toRem(DAY_END_HOUR * 60),
    nowRem: toRem(NOW_MINUTES),
  };
};

export const DAY_BY_MODE: Record<BreakMode, LaidDay> = {
  lane: buildDay('lane'),
  rule: buildDay('rule'),
  gutter: buildDay('gutter'),
  collapse: buildDay('collapse'),
};

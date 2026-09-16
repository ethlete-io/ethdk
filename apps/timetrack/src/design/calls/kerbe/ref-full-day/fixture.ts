import { Band, DayLaneFixture, DayStory, FULL_DAY_LANES, FULL_DAY_STORIES } from '../../../kerbe';

export const HOUR_REM = 8;
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 19;
export const GUTTER_REM = 5;
export const LANE_MIN_REM = 14;
export const BREAK_LANE_REM = 6;
export const STRIP_ROW_REM = 2.4;

export const STORIES: DayStory[] = FULL_DAY_STORIES;

export const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

export const NOW_REM = ((16 * 60 + 20 - DAY_START_HOUR * 60) / 60) * HOUR_REM;

export type Laid = { band: Band; topRem: number; inlineOffset: number; inlineSize: number };

export type LaidLane = { key: string; label: string; narrow: boolean; widthRem: number; laid: Laid[] };

const startOf = (band: Band) => {
  const [h = 0, m = 0] = band.from.split(':').map(Number);

  return h * 60 + m;
};

/** Packs a lane into the fewest overlap-free columns, the way `packLane` does in `day-review/lanes.ts`. */
const packLane = (bands: Band[]): Laid[] => {
  const sorted = [...bands].sort((a, b) => startOf(a) - startOf(b));
  const laid: Laid[] = [];
  let cluster: { band: Band; column: number }[] = [];
  let endsPerColumn: number[] = [];

  const flush = () => {
    if (!cluster.length) return;

    const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1));

    for (const entry of cluster) {
      laid.push({
        band: entry.band,
        topRem: ((startOf(entry.band) - DAY_START_HOUR * 60) / 60) * HOUR_REM,
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

  return laid;
};

const layOut = (lane: DayLaneFixture): LaidLane => ({
  key: lane.key,
  label: lane.label,
  narrow: lane.narrow ?? false,
  widthRem: lane.narrow ? BREAK_LANE_REM : LANE_MIN_REM,
  laid: packLane(lane.bands),
});

export const LANES: LaidLane[] = FULL_DAY_LANES.map(layOut);

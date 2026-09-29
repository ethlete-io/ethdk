import { isTimeSelectable, TimeBoundsOptions } from './time-availability';

export const MINUTES_PER_DAY = 24 * 60;

export type TimeRingStops = {
  step: number;
  minutes: readonly number[];
  open: readonly boolean[];
};

/** A run of stops, from the stop at `start` to the stop at `end`. `end` is less than `start` when the run wraps past midnight. */
export type TimeRingSpan = {
  start: number;
  end: number;
};

export type RingPoint = {
  x: number;
  y: number;
};

export type RingCircle = RingPoint & {
  radius: number;
};

export type TimeRingSpans = {
  open: TimeRingSpan[];
  blocked: TimeRingSpan[];
};

const wrapMinute = (minute: number) => ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** Midnight is at the top, and the angle grows clockwise in degrees. */
export const minuteToAngle = (minute: number) => (wrapMinute(minute) / MINUTES_PER_DAY) * 360;

export const angleToMinute = (angle: number) => wrapMinute((angle / 360) * MINUTES_PER_DAY);

/** The angle of a point around a centre, in the orientation of `minuteToAngle`. Screen coordinates, so `y` grows down. */
export const pointToAngle = (point: RingPoint, center: RingPoint) => {
  const degrees = (Math.atan2(point.x - center.x, center.y - point.y) * 180) / Math.PI;

  return (degrees + 360) % 360;
};

export const angleToPoint = (angle: number, circle: RingCircle): RingPoint => {
  const radians = (angle * Math.PI) / 180;

  return { x: circle.x + circle.radius * Math.sin(radians), y: circle.y - circle.radius * Math.cos(radians) };
};

export const snapMinute = (minute: number, step: number) => {
  const snapped = Math.round(wrapMinute(minute) / step) * step;

  return snapped >= MINUTES_PER_DAY ? 0 : snapped;
};

export const createTimeRingStops = (step: number, isOpen: (minute: number) => boolean): TimeRingStops => {
  const minutes: number[] = [];

  for (let minute = 0; minute < MINUTES_PER_DAY; minute += step) {
    minutes.push(minute);
  }

  return { step, minutes, open: minutes.map(isOpen) };
};

export const timeRingOpenCheck = (bounds: TimeBoundsOptions) => (minute: number) =>
  isTimeSelectable({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0 }, bounds);

const stopIndex = (stops: TimeRingStops, minute: number) => snapMinute(minute, stops.step) / stops.step;

export const isStopOpen = (stops: TimeRingStops, minute: number) => stops.open[stopIndex(stops, minute)] ?? false;

const collectRuns = (stops: TimeRingStops, open: boolean) => {
  const count = stops.minutes.length;
  const runs: { first: number; last: number }[] = [];

  for (let index = 0; index < count; index++) {
    if (stops.open[index] !== open) continue;

    const previous = runs[runs.length - 1];

    if (previous && previous.last === index - 1) {
      previous.last = index;
    } else {
      runs.push({ first: index, last: index });
    }
  }

  const head = runs[0];
  const tail = runs[runs.length - 1];

  if (runs.length > 1 && head && tail && head.first === 0 && tail.last === count - 1) {
    runs.shift();
    tail.last = head.last;
  }

  return runs.map((run) => ({ start: stops.minutes[run.first] ?? 0, end: stops.minutes[run.last] ?? 0 }));
};

export const timeRingSpans = (stops: TimeRingStops): TimeRingSpans => ({
  open: collectRuns(stops, true),
  blocked: collectRuns(stops, false),
});

/**
 * Moves from the stop at `from` towards `target` the short way round the ring, and stops at the last open stop
 * before a blocked one. A closed `from` returns `target` if it is open, and `from` if not.
 */
export const clampRingMove = (stops: TimeRingStops, move: { from: number; target: number }) => {
  const { from, target } = move;
  const count = stops.minutes.length;
  const fromIndex = stopIndex(stops, from);
  const targetIndex = stopIndex(stops, target);

  if (!stops.open[fromIndex]) {
    return stops.open[targetIndex] ? (stops.minutes[targetIndex] ?? from) : (stops.minutes[fromIndex] ?? from);
  }

  const forward = (targetIndex - fromIndex + count) % count;
  const direction = forward <= count / 2 ? 1 : -1;
  const distance = direction === 1 ? forward : count - forward;
  let index = fromIndex;

  for (let moved = 0; moved < distance; moved++) {
    const next = (index + direction + count) % count;

    if (!stops.open[next]) break;

    index = next;
  }

  return stops.minutes[index] ?? from;
};

export const firstOpenMinute = (stops: TimeRingStops) => {
  const index = stops.open.indexOf(true);

  return index === -1 ? null : (stops.minutes[index] ?? null);
};

export const lastOpenMinute = (stops: TimeRingStops) => {
  const index = stops.open.lastIndexOf(true);

  return index === -1 ? null : (stops.minutes[index] ?? null);
};

export const ringDuration = (start: number, end: number) => wrapMinute(end - start);

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

export const ringDuration = (start: number, end: number) => wrapMinute(end - start);

/** The signed minutes from `from` to `to` the short way round the ring, positive clockwise. */
export const ringOffset = (from: number, to: number) => {
  const forward = wrapMinute(to - from);

  return forward <= MINUTES_PER_DAY / 2 ? forward : forward - MINUTES_PER_DAY;
};

/**
 * Moves `travel` minutes from the stop at `from`, clockwise when positive, and stops at the last open stop before a
 * blocked one. A closed `from` returns the stop it travels to if that is open, and `from` if not.
 */
export const clampRingTravel = (stops: TimeRingStops, move: { from: number; travel: number }) => {
  const { from, travel } = move;
  const count = stops.minutes.length;
  const fromIndex = stopIndex(stops, from);

  if (!stops.open[fromIndex]) {
    const targetIndex = stopIndex(stops, from + travel);

    return stops.open[targetIndex] ? (stops.minutes[targetIndex] ?? from) : (stops.minutes[fromIndex] ?? from);
  }

  const direction = travel < 0 ? -1 : 1;
  const distance = Math.round(Math.abs(travel) / stops.step);
  let index = fromIndex;

  for (let moved = 0; moved < distance; moved++) {
    const next = (index + direction + count) % count;

    if (!stops.open[next]) break;

    index = next;
  }

  return stops.minutes[index] ?? from;
};

/**
 * {@link clampRingTravel}, except that a travel held at a blocked edge but ending on an open stop jumps to that stop,
 * unless `other` lies on the skipped arc. `jumped` is true when it jumped.
 */
export const dragRingTravel = (stops: TimeRingStops, move: { from: number; travel: number; other: number | null }) => {
  const { from, travel, other } = move;
  const edge = clampRingTravel(stops, move);
  const target = snapMinute(from + travel, stops.step);
  const held = { minute: edge, jumped: false };

  if (edge === target || !isStopOpen(stops, target)) {
    return held;
  }

  const forward = travel > 0;
  const start = snapMinute(from, stops.step);
  const moved = forward ? ringDuration(start, edge) : ringDuration(edge, start);
  const skipped = Math.abs(travel) - moved;

  if (other !== null) {
    const passed = forward ? ringDuration(edge, other) : ringDuration(other, edge);

    if (passed > 0 && passed <= skipped) {
      return held;
    }
  }

  return { minute: target, jumped: true };
};

/** {@link clampRingTravel} from `from` towards `target` the short way round the ring. */
export const clampRingMove = (stops: TimeRingStops, move: { from: number; target: number }) =>
  clampRingTravel(stops, {
    from: move.from,
    travel: ringOffset(snapMinute(move.from, stops.step), snapMinute(move.target, stops.step)),
  });

export const firstOpenMinute = (stops: TimeRingStops) => {
  const index = stops.open.indexOf(true);

  return index === -1 ? null : (stops.minutes[index] ?? null);
};

export const lastOpenMinute = (stops: TimeRingStops) => {
  const index = stops.open.lastIndexOf(true);

  return index === -1 ? null : (stops.minutes[index] ?? null);
};

/** Moves `delta` minutes from `from`, then on in the same direction to the next open stop. `null` when no stop is open. */
export const stepToOpenMinute = (stops: TimeRingStops, move: { from: number; delta: number }) => {
  const count = stops.minutes.length;
  const direction = move.delta < 0 ? -1 : 1;
  const start = stopIndex(stops, move.from + move.delta);

  for (let offset = 0; offset < count; offset++) {
    const index = (((start + direction * offset) % count) + count) % count;

    if (stops.open[index]) {
      return stops.minutes[index] ?? null;
    }
  }

  return null;
};

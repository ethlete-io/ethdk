import {
  angleToMinute,
  angleToPoint,
  clampRingMove,
  createTimeRingStops,
  firstOpenMinute,
  isStopOpen,
  lastOpenMinute,
  minuteToAngle,
  pointToAngle,
  ringDuration,
  snapMinute,
  timeRingOpenCheck,
  timeRingSpans,
} from './time-ring';

const DAY = new Date(2026, 6, 17);
const at = (hour: number, minute = 0) => hour * 60 + minute;
const openBetween = (from: number, to: number) => (minute: number) =>
  from <= to ? minute >= from && minute <= to : minute >= from || minute <= to;

describe('time-ring', () => {
  describe('angles', () => {
    it('puts midnight at the top and grows clockwise', () => {
      expect(minuteToAngle(0)).toBe(0);
      expect(minuteToAngle(at(6))).toBe(90);
      expect(minuteToAngle(at(12))).toBe(180);
      expect(minuteToAngle(at(18))).toBe(270);
      expect(minuteToAngle(at(24))).toBe(0);
      expect(minuteToAngle(-60)).toBe(345);
    });

    it('turns an angle back into a minute of the day', () => {
      expect(angleToMinute(90)).toBe(at(6));
      expect(angleToMinute(360)).toBe(0);
      expect(angleToMinute(-90)).toBe(at(18));
    });

    it('reads the angle of a point in screen coordinates', () => {
      expect(pointToAngle({ x: 100, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(0);
      expect(pointToAngle({ x: 200, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(90);
      expect(pointToAngle({ x: 100, y: 200 }, { x: 100, y: 100 })).toBeCloseTo(180);
      expect(pointToAngle({ x: 0, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(270);
    });

    it('places a point on the ring for an angle', () => {
      const point = angleToPoint(90, { radius: 112, x: 140, y: 140 });

      expect(point.x).toBeCloseTo(252);
      expect(point.y).toBeCloseTo(140);
    });
  });

  describe('snapMinute', () => {
    it('rounds to the nearest step', () => {
      expect(snapMinute(at(9, 32), 5)).toBe(at(9, 30));
      expect(snapMinute(at(9, 33), 5)).toBe(at(9, 35));
    });

    it('wraps past midnight to 0', () => {
      expect(snapMinute(at(23, 58), 5)).toBe(0);
      expect(snapMinute(-3, 5)).toBe(at(23, 55));
    });

    it('picks midnight or the last stop for a step that does not divide the day', () => {
      expect(snapMinute(1439, 7)).toBe(0);
      expect(snapMinute(1435, 7)).toBe(1435);
    });
  });

  describe('stops', () => {
    it('has one stop per step', () => {
      expect(createTimeRingStops(5, () => true).minutes).toHaveLength(288);
      expect(createTimeRingStops(60, () => true).minutes).toEqual(Array.from({ length: 24 }, (_, hour) => at(hour)));
    });

    it('reads min, max and the filter through the bounds', () => {
      const stops = createTimeRingStops(
        30,
        timeRingOpenCheck({
          min: new Date(2026, 6, 17, 8),
          max: new Date(2026, 6, 17, 18),
          filter: (date) => date.getHours() !== 12,
          day: DAY,
        }),
      );

      expect(isStopOpen(stops, at(7, 30))).toBe(false);
      expect(isStopOpen(stops, at(8))).toBe(true);
      expect(isStopOpen(stops, at(12, 30))).toBe(false);
      expect(isStopOpen(stops, at(18))).toBe(true);
      expect(isStopOpen(stops, at(18, 30))).toBe(false);
    });

    it('finds the first and the last open time', () => {
      const stops = createTimeRingStops(15, openBetween(at(8), at(18)));

      expect(firstOpenMinute(stops)).toBe(at(8));
      expect(lastOpenMinute(stops)).toBe(at(18));
      expect(firstOpenMinute(createTimeRingStops(15, () => false))).toBeNull();
    });
  });

  describe('timeRingSpans', () => {
    it('gives one open span and no blocked span for a free day', () => {
      expect(timeRingSpans(createTimeRingStops(60, () => true))).toEqual({
        open: [{ start: 0, end: at(23) }],
        blocked: [],
      });
    });

    it('merges runs of stops into spans', () => {
      const stops = createTimeRingStops(60, (minute) => minute >= at(8) && minute <= at(18) && minute !== at(12));

      expect(timeRingSpans(stops)).toEqual({
        open: [
          { start: at(8), end: at(11) },
          { start: at(13), end: at(18) },
        ],
        blocked: [
          { start: at(12), end: at(12) },
          { start: at(19), end: at(7) },
        ],
      });
    });

    it('joins an open span across midnight', () => {
      const stops = createTimeRingStops(60, openBetween(at(22), at(6)));

      expect(timeRingSpans(stops)).toEqual({
        open: [{ start: at(22), end: at(6) }],
        blocked: [{ start: at(7), end: at(21) }],
      });
    });
  });

  describe('clampRingMove', () => {
    const stops = createTimeRingStops(15, openBetween(at(8), at(18)));

    it('moves freely inside an open span', () => {
      expect(clampRingMove(stops, { from: at(9), target: at(10, 30) })).toBe(at(10, 30));
      expect(clampRingMove(stops, { from: at(10), target: at(9) })).toBe(at(9));
    });

    it('stops at the edge of a blocked span', () => {
      expect(clampRingMove(stops, { from: at(17), target: at(19) })).toBe(at(18));
      expect(clampRingMove(stops, { from: at(9), target: at(7) })).toBe(at(8));
    });

    it('takes the short way round, so a drag never jumps over the blocked night', () => {
      expect(clampRingMove(stops, { from: at(17), target: at(9) })).toBe(at(9));
      expect(clampRingMove(stops, { from: at(8, 15), target: at(2) })).toBe(at(8));
    });

    it('moves across midnight when the night is open', () => {
      const night = createTimeRingStops(15, openBetween(at(22), at(6)));

      expect(clampRingMove(night, { from: at(23, 30), target: at(0, 30) })).toBe(at(0, 30));
      expect(clampRingMove(night, { from: at(5), target: at(7) })).toBe(at(6));
    });

    it('jumps from a blocked start to an open target, and stays otherwise', () => {
      expect(clampRingMove(stops, { from: at(3), target: at(9) })).toBe(at(9));
      expect(clampRingMove(stops, { from: at(3), target: at(4) })).toBe(at(3));
    });
  });

  describe('ringDuration', () => {
    it('counts clockwise, also past midnight', () => {
      expect(ringDuration(at(9), at(17, 30))).toBe(at(8, 30));
      expect(ringDuration(at(22), at(6))).toBe(at(8));
      expect(ringDuration(at(9), at(9))).toBe(0);
    });
  });
});

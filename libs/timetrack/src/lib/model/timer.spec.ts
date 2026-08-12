import { describe, expect, it } from 'vitest';
import { closeTimerRun, isTimerRunning, timerRunDurationMs } from './timer';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

describe('isTimerRunning', () => {
  it('is running only while it has no end', () => {
    expect(isTimerRunning({ id: 'a', from: at(9) })).toBe(true);
    expect(isTimerRunning({ id: 'a', from: at(9), to: at(10) })).toBe(false);
  });
});

describe('closeTimerRun', () => {
  it('leaves a run that already ended alone', () => {
    expect(closeTimerRun({ id: 'a', from: at(9), to: at(10) }, at(14)).to).toEqual(at(10));
  });

  it('closes an open run at the given instant', () => {
    expect(closeTimerRun({ id: 'a', from: at(9) }, at(9, 45)).to).toEqual(at(9, 45));
  });

  it('never ends a run before it started, however far back the clock stepped', () => {
    expect(closeTimerRun({ id: 'a', from: at(9) }, at(8)).to).toEqual(at(9));
    expect(timerRunDurationMs(closeTimerRun({ id: 'a', from: at(9) }, at(8)))).toBe(0);
  });
});

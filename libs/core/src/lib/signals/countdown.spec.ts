import { Injector, PLATFORM_ID, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CountdownDeadline, signalCountdown } from './countdown';

const NOW = new Date('2026-06-01T12:00:00.000Z').getTime();

describe('signalCountdown', () => {
  const setup = (deadline: () => CountdownDeadline) => {
    const countdown = runInInjectionContext(TestBed.inject(Injector), () => signalCountdown(deadline));

    TestBed.tick();

    return countdown;
  };

  const advance = (ms: number) => {
    vi.advanceTimersByTime(ms);
    TestBed.tick();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('breaks the time left down into days, hours, minutes and seconds', () => {
    const countdown = setup(() => NOW + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000);

    expect(countdown()).toEqual({
      totalSeconds: 183_845,
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      hasPassed: false,
    });
  });

  it('accepts an ISO string and a Date', () => {
    expect(setup(() => '2026-06-01T12:01:00.000Z')()?.totalSeconds).toBe(60);
    expect(setup(() => new Date(NOW + 30_000))()?.totalSeconds).toBe(30);
  });

  it('is null for a missing or invalid deadline', () => {
    expect(setup(() => null)()).toBeNull();
    expect(setup(() => undefined)()).toBeNull();
    expect(setup(() => '')()).toBeNull();
    expect(setup(() => 'not a date')()).toBeNull();
  });

  it('rounds a partial second up and changes exactly on the whole second', () => {
    const countdown = setup(() => NOW + 2500);

    expect(countdown()?.seconds).toBe(3);

    advance(499);
    expect(countdown()?.seconds).toBe(3);

    advance(1);
    expect(countdown()?.seconds).toBe(2);

    advance(1000);
    expect(countdown()?.seconds).toBe(1);
  });

  it('reports the deadline as passed and stops its timer', () => {
    const countdown = setup(() => NOW + 1500);

    advance(1500);

    expect(countdown()).toEqual({ totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0, hasPassed: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts no timer for a deadline already in the past', () => {
    const countdown = setup(() => NOW - 5000);

    expect(countdown()?.hasPassed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows a deadline that changes', () => {
    const deadline = signal<CountdownDeadline>(NOW + 10_000);
    const countdown = setup(deadline);

    deadline.set(NOW + 60_000);
    TestBed.tick();

    expect(countdown()?.totalSeconds).toBe(60);

    advance(1000);
    expect(countdown()?.totalSeconds).toBe(59);

    deadline.set(null);
    TestBed.tick();

    expect(countdown()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts no timer on the server', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });

    const countdown = setup(() => NOW + 10_000);

    expect(countdown()?.totalSeconds).toBe(10);
    expect(vi.getTimerCount()).toBe(0);
  });
});

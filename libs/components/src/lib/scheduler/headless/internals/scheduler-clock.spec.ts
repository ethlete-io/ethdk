import {
  Injector,
  PLATFORM_ID,
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectSchedulerClock } from './scheduler-clock';

const NOW = new Date(2026, 6, 15, 10, 0, 30).getTime();

describe('injectSchedulerClock', () => {
  const setup = (enabled: () => boolean) => {
    const clock = runInInjectionContext(TestBed.inject(Injector), () => injectSchedulerClock(enabled));

    TestBed.tick();

    return clock;
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

  it('changes on the next minute boundary, then on every one after it', () => {
    const clock = setup(() => true);

    expect(clock().getMinutes()).toBe(0);

    advance(29_999);
    expect(clock().getMinutes()).toBe(0);

    advance(1);
    expect(clock().getMinutes()).toBe(1);

    advance(60_000);
    expect(clock().getMinutes()).toBe(2);
  });

  it('runs no timer while disabled, and catches up when enabled again', () => {
    const enabled = signal(true);
    const clock = setup(enabled);

    enabled.set(false);
    TestBed.tick();

    expect(vi.getTimerCount()).toBe(0);

    advance(5 * 60_000);
    enabled.set(true);
    TestBed.tick();

    expect(clock().getMinutes()).toBe(5);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('starts no timer on the server', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });

    const clock = setup(() => true);

    expect(clock().getTime()).toBe(NOW);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops its timer when its injector is destroyed', () => {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

    runInInjectionContext(injector, () => injectSchedulerClock(() => true));
    TestBed.tick();

    expect(vi.getTimerCount()).toBe(1);

    injector.destroy();

    expect(vi.getTimerCount()).toBe(0);
  });
});

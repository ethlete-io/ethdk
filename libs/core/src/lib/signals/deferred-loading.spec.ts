import { Injector, WritableSignal, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { signalDeferredLoading } from './deferred-loading';

describe('signalDeferredLoading', () => {
  let injector: Injector;

  const setup = (loading: WritableSignal<boolean>, options?: { delay?: number; minDuration?: number }) => {
    const deferred = runInInjectionContext(injector, () => signalDeferredLoading(loading, options));

    TestBed.tick();

    return deferred;
  };

  const advance = (ms: number) => {
    vi.advanceTimersByTime(ms);
    TestBed.tick();
  };

  // the effect reacts to a source change before any timer can fire - in an app the change
  // detection that runs it is scheduled as a microtask
  const setLoading = (loading: WritableSignal<boolean>, value: boolean) => {
    loading.set(value);
    TestBed.tick();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays off while the source turns true and false again inside the delay', () => {
    const loading = signal(false);
    const deferred = setup(loading);

    setLoading(loading, true);
    advance(150);

    expect(deferred()).toBe(false);

    setLoading(loading, false);
    advance(1000);

    expect(deferred()).toBe(false);
  });

  it('turns on once the source has been true for the delay', () => {
    const loading = signal(true);
    const deferred = setup(loading);

    advance(199);

    expect(deferred()).toBe(false);

    advance(1);

    expect(deferred()).toBe(true);
  });

  it('stays on for the minimum duration after the source goes false', () => {
    const loading = signal(true);
    const deferred = setup(loading);

    advance(200);
    setLoading(loading, false);
    advance(299);

    expect(deferred()).toBe(true);

    advance(1);

    expect(deferred()).toBe(false);
  });

  it('drops the pending hide when the source turns true again', () => {
    const loading = signal(true);
    const deferred = setup(loading);

    advance(200);
    setLoading(loading, false);
    advance(100);
    setLoading(loading, true);
    advance(1000);

    expect(deferred()).toBe(true);
  });

  it('hides immediately once the minimum duration has passed', () => {
    const loading = signal(true);
    const deferred = setup(loading);

    advance(600);
    setLoading(loading, false);

    expect(deferred()).toBe(false);
  });

  it('honours custom timings', () => {
    const loading = signal(true);
    const deferred = setup(loading, { delay: 0, minDuration: 0 });

    advance(0);

    expect(deferred()).toBe(true);

    setLoading(loading, false);
    advance(0);

    expect(deferred()).toBe(false);
  });
});

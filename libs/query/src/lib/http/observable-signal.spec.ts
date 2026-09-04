import {
  computed,
  createEnvironmentInjector,
  effect,
  EnvironmentInjector,
  isSignal,
  signal,
  untracked,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { wrapAsObservableSignal } from './observable-signal';

describe('wrapAsObservableSignal', () => {
  let defaultInjector: EnvironmentInjector;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    defaultInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    if (!defaultInjector.destroyed) {
      defaultInjector.destroy();
    }
  });

  it('should not mutate the wrapped signal', () => {
    const src = signal(1);
    const wrapped = wrapAsObservableSignal(src, defaultInjector);

    expect('asObservable' in src).toBe(false);
    expect(wrapped).not.toBe(src as unknown as typeof wrapped);
    expect(typeof wrapped.asObservable).toBe('function');
  });

  it('should behave like a signal', () => {
    const src = signal(1);
    const wrapped = wrapAsObservableSignal(src, defaultInjector);

    expect(isSignal(wrapped)).toBe(true);
    expect(untracked(wrapped)).toBe(1);

    const doubled = computed(() => wrapped() * 2);
    expect(doubled()).toBe(2);

    const seen: number[] = [];
    effect(() => seen.push(wrapped()), { injector: defaultInjector });
    TestBed.tick();

    src.set(2);
    TestBed.tick();

    expect(doubled()).toBe(4);
    expect(seen).toEqual([1, 2]);
  });

  it('should give each wrapper of the same source its own lifetime', () => {
    const otherInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const src = signal(0);
    const first = wrapAsObservableSignal(src, defaultInjector);
    const second = wrapAsObservableSignal(src, otherInjector);

    let firstCompleted = false;
    let secondCompleted = false;
    const firstEmissions: number[] = [];
    const secondEmissions: number[] = [];

    first.asObservable().subscribe({ next: (v) => firstEmissions.push(v), complete: () => (firstCompleted = true) });
    second.asObservable().subscribe({ next: (v) => secondEmissions.push(v), complete: () => (secondCompleted = true) });
    TestBed.tick();

    defaultInjector.destroy();
    src.set(1);
    TestBed.tick();

    expect(firstCompleted).toBe(true);
    expect(secondCompleted).toBe(false);
    expect(firstEmissions).toEqual([0]);
    expect(secondEmissions).toEqual([0, 1]);

    otherInjector.destroy();
  });

  it('should still read the signal value via call', () => {
    const src = signal(42);
    const wrapped = wrapAsObservableSignal(src, defaultInjector);

    expect(wrapped()).toBe(42);

    src.set(99);
    expect(wrapped()).toBe(99);
  });

  describe('asObservable()', () => {
    it('should emit the current value immediately on subscribe', () => {
      const src = signal('hello');
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      const emissions: string[] = [];
      wrapped.asObservable().subscribe((v) => emissions.push(v));
      TestBed.tick();

      expect(emissions).toEqual(['hello']);
    });

    it('should emit updated values when the signal changes', () => {
      const src = signal(0);
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      const emissions: number[] = [];
      wrapped.asObservable().subscribe((v) => emissions.push(v));
      TestBed.tick();

      src.set(1);
      TestBed.tick();
      src.set(2);
      TestBed.tick();

      expect(emissions).toEqual([0, 1, 2]);
    });

    it('should complete when the default injector is destroyed', () => {
      const src = signal(0);
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      let completed = false;
      wrapped.asObservable().subscribe({ complete: () => (completed = true) });
      TestBed.tick();

      defaultInjector.destroy();
      TestBed.tick();

      expect(completed).toBe(true);
    });

    it('should emit using the override injector when provided', () => {
      const overrideInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      const src = signal('a');
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      const emissions: string[] = [];
      wrapped.asObservable({ injector: overrideInjector }).subscribe((v) => emissions.push(v));
      TestBed.tick();

      src.set('b');
      TestBed.tick();

      expect(emissions).toEqual(['a', 'b']);

      overrideInjector.destroy();
    });

    it('should complete when the override injector is destroyed', () => {
      const overrideInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      const src = signal(0);
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      let completed = false;
      wrapped.asObservable({ injector: overrideInjector }).subscribe({ complete: () => (completed = true) });
      TestBed.tick();

      overrideInjector.destroy();
      TestBed.tick();

      expect(completed).toBe(true);
    });

    it('should complete when the default injector is destroyed even if an override injector is provided', () => {
      const overrideInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      const src = signal(0);
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      let completed = false;
      wrapped.asObservable({ injector: overrideInjector }).subscribe({ complete: () => (completed = true) });
      TestBed.tick();

      // destroy the default injector - min(override, default) should win
      defaultInjector.destroy();
      TestBed.tick();

      expect(completed).toBe(true);

      overrideInjector.destroy();
    });

    it('should not emit after the default injector is destroyed even if signal changes', () => {
      const src = signal(0);
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      const emissions: number[] = [];
      wrapped.asObservable().subscribe((v) => emissions.push(v));
      TestBed.tick();

      defaultInjector.destroy();

      src.set(1);
      TestBed.tick();

      expect(emissions).toEqual([0]);
    });

    it('should reuse the observable created for an override injector', () => {
      const overrideInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      const src = signal(0);
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      expect(wrapped.asObservable({ injector: overrideInjector })).toBe(
        wrapped.asObservable({ injector: overrideInjector }),
      );

      overrideInjector.destroy();
    });

    it('should allow multiple independent subscriptions', () => {
      const src = signal('x');
      const wrapped = wrapAsObservableSignal(src, defaultInjector);

      const a: string[] = [];
      const b: string[] = [];
      wrapped.asObservable().subscribe((v) => a.push(v));
      wrapped.asObservable().subscribe((v) => b.push(v));
      TestBed.tick();

      src.set('y');
      TestBed.tick();

      expect(a).toEqual(['x', 'y']);
      expect(b).toEqual(['x', 'y']);
    });
  });
});

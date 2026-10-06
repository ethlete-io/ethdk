import {
  createEnvironmentInjector,
  EnvironmentInjector,
  signal,
  ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createObservableSignalWatcher } from './observable-signal-watcher';

describe('createObservableSignalWatcher', () => {
  let injector: EnvironmentInjector;
  let addedEffects: ReturnType<typeof vi.spyOn>;
  let removedEffects: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const scheduler = TestBed.inject(EffectScheduler);
    addedEffects = vi.spyOn(scheduler, 'add');
    removedEffects = vi.spyOn(scheduler, 'remove');
  });

  afterEach(() => {
    if (!injector.destroyed) injector.destroy();
  });

  it('should create no effect until asObservable() is called', () => {
    const watcher = createObservableSignalWatcher(injector);
    const a = watcher.wrap(signal(1));
    watcher.wrap(signal(2));
    TestBed.tick();

    expect(a()).toBe(1);
    expect(addedEffects).not.toHaveBeenCalled();

    a.asObservable();

    expect(addedEffects).toHaveBeenCalledTimes(1);
  });

  it('should serve every signal of the owner from one effect', () => {
    const watcher = createObservableSignalWatcher(injector);
    const first = signal('a');
    const second = signal(1);
    const firstSeen: string[] = [];
    const secondSeen: number[] = [];

    watcher
      .wrap(first)
      .asObservable()
      .subscribe((v) => firstSeen.push(v));
    TestBed.tick();
    watcher
      .wrap(second)
      .asObservable()
      .subscribe((v) => secondSeen.push(v));
    TestBed.tick();

    first.set('b');
    TestBed.tick();
    second.set(2);
    TestBed.tick();

    expect(addedEffects).toHaveBeenCalledTimes(1);
    expect(firstSeen).toEqual(['a', 'b']);
    expect(secondSeen).toEqual([1, 2]);
  });

  it('should replay the current value synchronously to a late subscriber', () => {
    const src = signal(0);
    const wrapped = createObservableSignalWatcher(injector).wrap(src);
    const observable = wrapped.asObservable();
    TestBed.tick();

    src.set(1);
    const seen: number[] = [];
    observable.subscribe((v) => seen.push(v));

    expect(seen).toEqual([1]);

    TestBed.tick();

    expect(seen).toEqual([1]);
  });

  it('should emit each value once and in order when the signal changes between effect runs', () => {
    const src = signal(0);
    const observable = createObservableSignalWatcher(injector).wrap(src).asObservable();
    const early: number[] = [];
    const late: number[] = [];

    observable.subscribe((v) => early.push(v));
    src.set(1);
    observable.subscribe((v) => late.push(v));
    src.set(2);
    TestBed.tick();
    src.set(3);
    src.set(2);
    TestBed.tick();

    expect(early).toEqual([0, 1, 2]);
    expect(late).toEqual([1, 2]);
  });

  it('should destroy the effect and complete every stream with the owner', () => {
    const watcher = createObservableSignalWatcher(injector);
    const completed: string[] = [];

    watcher
      .wrap(signal(1))
      .asObservable()
      .subscribe({ complete: () => completed.push('a') });
    watcher
      .wrap(signal(2))
      .asObservable()
      .subscribe({ complete: () => completed.push('b') });
    TestBed.tick();

    injector.destroy();

    expect(removedEffects).toHaveBeenCalledTimes(1);
    expect(completed).toEqual(['a', 'b']);
  });

  it('should replay the last value and complete when asked after the owner was destroyed', () => {
    const wrapped = createObservableSignalWatcher(injector).wrap(signal(5));
    injector.destroy();

    const seen: number[] = [];
    let completed = false;
    wrapped.asObservable().subscribe({ next: (v) => seen.push(v), complete: () => (completed = true) });

    expect(addedEffects).not.toHaveBeenCalled();
    expect(seen).toEqual([5]);
    expect(completed).toBe(true);
  });
});

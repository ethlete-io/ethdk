import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AbstractControl, FormControl } from '@angular/forms';
import { controlValueSignal, controlValueSignalWithPrevious } from './control-value';

describe('controlValueSignal', () => {
  const run = <T>(fn: () => T) => runInInjectionContext(TestBed.inject(Injector), fn);

  it('reads the current value and follows changes', () => {
    const control = new FormControl<number | null>(1);
    const value = run(() => controlValueSignal(control));

    expect(value()).toBe(1);

    control.setValue(2);
    expect(value()).toBe(2);
  });

  it('is null for a signal holding no control and picks one up once set', () => {
    const control = signal<AbstractControl | null>(null);
    const value = run(() => controlValueSignal(control));

    expect(value()).toBeNull();

    control.set(new FormControl('a'));
    TestBed.tick();
    expect(value()).toBe('a');
  });

  it('does not emit for an equal Date', () => {
    const control = new FormControl(new Date(2026, 0, 1));
    const value = run(() => controlValueSignal(control));
    const first = value();

    control.setValue(new Date(2026, 0, 1));
    expect(value()).toBe(first);

    control.setValue(new Date(2026, 0, 2));
    expect(value()).toEqual(new Date(2026, 0, 2));
  });

  it('keeps NaN stable', () => {
    const control = new FormControl(NaN);
    const value = run(() => controlValueSignal(control));

    control.setValue(NaN);
    expect(value()).toBeNaN();
  });

  it('starts at null with debounceFirst and emits the first value after the debounce', () => {
    vi.useFakeTimers();
    const control = new FormControl('a');
    const value = run(() => controlValueSignal(control, { debounceTime: 50, debounceFirst: true }));

    expect(value()).toBeNull();

    vi.advanceTimersByTime(50);
    expect(value()).toBe('a');
    vi.useRealTimers();
  });
});

describe('controlValueSignalWithPrevious', () => {
  it('pairs the previous with the current value', () => {
    const control = new FormControl(1);
    const pair = runInInjectionContext(TestBed.inject(Injector), () => controlValueSignalWithPrevious(control));

    expect(pair()).toEqual([null, 1]);

    control.setValue(2);
    expect(pair()).toEqual([1, 2]);
  });
});

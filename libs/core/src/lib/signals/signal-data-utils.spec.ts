import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { memoizeSignal } from './signal-data-utils';

describe('memoizeSignal', () => {
  it('builds the signal once per application, not once per environment injector', () => {
    let factoryCalls = 0;
    const memoized = memoizeSignal(() => {
      factoryCalls++;

      return signal(factoryCalls).asReadonly();
    });

    const rootInjector = TestBed.inject(EnvironmentInjector);
    const childInjector = createEnvironmentInjector([], rootInjector);

    const fromRoot = runInInjectionContext(rootInjector, () => memoized());
    const fromChild = runInInjectionContext(childInjector, () => memoized());

    expect(fromChild).toBe(fromRoot);
    expect(factoryCalls).toBe(1);

    childInjector.destroy();
  });

  it('keeps the signal alive when the injector that first asked for it is destroyed', () => {
    const memoized = memoizeSignal(() => signal('value').asReadonly());

    const rootInjector = TestBed.inject(EnvironmentInjector);
    const childInjector = createEnvironmentInjector([], rootInjector);

    const fromChild = runInInjectionContext(childInjector, () => memoized());
    childInjector.destroy();

    expect(runInInjectionContext(rootInjector, () => memoized())).toBe(fromChild);
  });
});

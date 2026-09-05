import { EnvironmentInjector, createEnvironmentInjector, effect, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { registerSingleton } from './register-singleton';

describe('registerSingleton', () => {
  it('registers from an effect without making that effect re-run', () => {
    const target = signal<object | null>(null);
    const instance = {};
    const injector = TestBed.inject(EnvironmentInjector);
    let runs = 0;

    TestBed.runInInjectionContext(() => {
      effect(() => {
        runs++;
        runInInjectionContext(injector, () => registerSingleton(target, instance));
      });
    });

    TestBed.tick();
    TestBed.tick();

    expect(target()).toBe(instance);
    expect(runs).toBe(1);
  });

  it('leaves a replacement that registered before this one tore down in place', () => {
    const target = signal<object | null>(null);
    const first = {};
    const second = {};
    const parent = TestBed.inject(EnvironmentInjector);
    const firstInjector = createEnvironmentInjector([], parent);
    const secondInjector = createEnvironmentInjector([], parent);

    runInInjectionContext(firstInjector, () => registerSingleton(target, first));
    runInInjectionContext(secondInjector, () => registerSingleton(target, second));

    firstInjector.destroy();

    expect(target()).toBe(second);

    secondInjector.destroy();

    expect(target()).toBeNull();
  });
});

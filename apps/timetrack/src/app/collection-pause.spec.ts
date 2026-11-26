import { EnvironmentInjector, Injector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { CollectionState, HOST_PORTS, HostPorts } from '../host';
import { injectCollectionPause } from './collection-pause';

vi.mock('@ethlete/core', () => ({
  defineRootProvider: <T>(factory: () => T) => factory,
  toInjectFn: <T>(factory: () => T) => factory,
}));

const setup = (collection: {
  state$: () => Observable<CollectionState>;
  setPaused$: (paused: boolean, at: Date) => Observable<CollectionState>;
}) => {
  const injector = createEnvironmentInjector(
    [{ provide: HOST_PORTS, useValue: { collection } as unknown as HostPorts }],
    Injector.NULL as EnvironmentInjector,
  );

  return { pause: runInInjectionContext(injector, () => injectCollectionPause()), injector };
};

describe('injectCollectionPause', () => {
  it('asks the host for the opposite of the state it last reported', () => {
    const asked: boolean[] = [];
    const pausedAt = new Date('2026-10-03T09:00:00Z');
    const { pause, injector } = setup({
      state$: () => of({ pausedAt: null }),
      setPaused$: (paused) => {
        asked.push(paused);

        return of({ pausedAt: paused ? pausedAt : null });
      },
    });

    pause.toggle();
    expect(pause.isPaused()).toBe(true);
    expect(pause.pausedAt()).toBe(pausedAt);

    pause.toggle();
    expect(pause.isPaused()).toBe(false);
    expect(asked).toEqual([true, false]);
    injector.destroy();
  });

  it('keeps the state and reports the failure when the host refuses, and still toggles afterwards', () => {
    let fail = true;
    const { pause, injector } = setup({
      state$: () => of({ pausedAt: null }),
      setPaused$: () => (fail ? throwError(() => new Error('store locked')) : of({ pausedAt: new Date() })),
    });

    pause.toggle();
    expect(pause.isPaused()).toBe(false);
    expect(pause.failure()).toBe('store locked');

    fail = false;
    pause.toggle();
    expect(pause.isPaused()).toBe(true);
    expect(pause.failure()).toBeNull();
    injector.destroy();
  });

  it('reports a failed state read without pausing', () => {
    const { pause, injector } = setup({
      state$: () => throwError(() => new Error('host gone')),
      setPaused$: () => of({ pausedAt: null }),
    });

    expect(pause.isPaused()).toBe(false);
    expect(pause.pausedForMs()).toBe(0);
    expect(pause.failure()).toBe('host gone');
    injector.destroy();
  });
});

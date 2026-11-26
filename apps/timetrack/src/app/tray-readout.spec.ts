import '@angular/compiler';
import {
  ApplicationRef,
  EnvironmentInjector,
  Injector,
  createEnvironmentInjector,
  provideZonelessChangeDetection,
  runInInjectionContext,
  ɵINJECTOR_SCOPE,
} from '@angular/core';
import * as timetrack from '@ethlete/timetrack';
import { createFakePorts } from '../e2e/fake-ports';
import { injectWindowCollector } from '../collectors/window-collector';
import { HOST_PORTS } from '../host';
import { injectTrayReadout } from './tray-readout';

vi.mock('@ethlete/timetrack', async (original) => {
  const actual = await original<typeof timetrack>();

  return { ...actual, streamDay: vi.fn(actual.streamDay) };
});

describe('the tray readout of today', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 10, 19, 10, 0) }));
  afterEach(() => vi.useRealTimers());

  it('builds today once while the collectors drain and store nothing', async () => {
    const injector = createEnvironmentInjector(
      [
        { provide: ɵINJECTOR_SCOPE, useValue: 'root' },
        provideZonelessChangeDetection(),
        { provide: HOST_PORTS, useValue: createFakePorts() },
      ],
      Injector.NULL as EnvironmentInjector,
    );
    const app = injector.get(ApplicationRef);
    const windows = runInInjectionContext(injector, () => injectWindowCollector());

    runInInjectionContext(injector, () => injectTrayReadout());

    const settle = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      app.tick();
    };

    await settle(1_000);

    const built = vi.mocked(timetrack.streamDay).mock.calls.length;

    for (let second = 0; second < 45; second++) {
      windows.lastRun.set({ at: new Date(), stored: 0, excluded: 0, dropped: 0 });
      await settle(1_000);
    }

    expect(vi.mocked(timetrack.streamDay).mock.calls.length).toBe(built);

    injector.destroy();
  });
});

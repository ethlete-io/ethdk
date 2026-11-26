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
import { firstValueFrom } from 'rxjs';
import { createFakePorts } from '../e2e/fake-ports';
import { injectWindowCollector } from '../collectors/window-collector';
import { HOST_PORTS } from '../host';
import type * as dayBuild from './day-build/build-day';
import { injectDayNudge } from './day-nudge';
import { injectTrayReadout } from './tray-readout';

const readerBuilds = vi.hoisted(() => ({ count: 0 }));

vi.mock('./day-build/build-day', async (original) => {
  const actual = await original<typeof dayBuild>();

  return {
    ...actual,
    streamDay$: vi.fn((input: Parameters<typeof actual.streamDay$>[0]) => {
      if (new Error().stack?.includes('read-day')) readerBuilds.count++;

      return actual.streamDay$(input);
    }),
  };
});

describe('the today readers of tray and nudge', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 10, 19, 10, 0) }));
  afterEach(() => vi.useRealTimers());

  it('build today once per minute and once per new event, not once per reader', async () => {
    const ports = createFakePorts();
    const injector = createEnvironmentInjector(
      [
        { provide: ɵINJECTOR_SCOPE, useValue: 'root' },
        provideZonelessChangeDetection(),
        { provide: HOST_PORTS, useValue: ports },
      ],
      Injector.NULL as EnvironmentInjector,
    );
    const app = injector.get(ApplicationRef);
    const windows = runInInjectionContext(injector, () => injectWindowCollector());

    runInInjectionContext(injector, () => {
      injectTrayReadout();
      injectDayNudge();
    });

    const settle = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      app.tick();
    };

    await settle(1_000);

    const started = readerBuilds.count;

    await settle(149_000);

    expect(readerBuilds.count - started).toBe(2);

    const beforeEvent = readerBuilds.count;

    await firstValueFrom(
      ports.events.append$([{ at: new Date(), source: 'window', kind: 'window-focus', appId: 'code', title: 'shop' }]),
    );
    windows.lastRun.set({ at: new Date(), stored: 1, excluded: 0, dropped: 0 });
    await settle(1_000);

    expect(readerBuilds.count - beforeEvent).toBe(1);

    injector.destroy();
  });
});

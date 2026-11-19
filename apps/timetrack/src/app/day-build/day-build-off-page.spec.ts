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
import { createFakePorts } from '../../e2e/fake-ports';
import { HOST_PORTS } from '../../host';
import { injectDayNudge } from '../day-nudge';
import { injectDayReview } from '../day-review/day-review';
import { injectTrayReadout } from '../tray-readout';

const builds = vi.hoisted(() => ({ inWorker: 0, onPage: 0 }));

vi.mock('@ethlete/timetrack', async (original) => {
  const actual = await original<typeof timetrack>();
  const counted =
    <T extends (...args: never[]) => unknown>(build: T) =>
    (...args: Parameters<T>) => {
      if (new Error().stack?.includes('test-setup')) builds.inWorker++;
      else builds.onPage++;

      return build(...args);
    };

  return { ...actual, streamDay: counted(actual.streamDay), buildRows: counted(actual.buildRows) };
});

describe('the day build', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 10, 19, 10, 0) });
    builds.inWorker = 0;
    builds.onPage = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('runs in the day build worker for the day screen, the tray and the nudge, never on the page', async () => {
    const injector = createEnvironmentInjector(
      [
        { provide: ɵINJECTOR_SCOPE, useValue: 'root' },
        provideZonelessChangeDetection(),
        { provide: HOST_PORTS, useValue: createFakePorts() },
      ],
      Injector.NULL as EnvironmentInjector,
    );
    const app = injector.get(ApplicationRef);
    const review = runInInjectionContext(injector, () => {
      injectTrayReadout();
      injectDayNudge();

      return injectDayReview();
    });

    for (let second = 0; second < 90; second++) {
      await vi.advanceTimersByTimeAsync(1_000);
      app.tick();
      review.day();
    }

    expect(review.day()?.rows).toBeTruthy();
    expect(builds.onPage).toBe(0);
    expect(builds.inWorker).toBeGreaterThan(0);

    injector.destroy();
  });
});

describe('the app source', () => {
  it('calls the day build only from the day build worker', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(import.meta.dirname, '../..');
    const callers = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.includes('day-build/day-build.'))
      .filter((file) => /\b(streamDay|buildRows)\(/.test(readFileSync(join(root, file), 'utf8')));

    expect(callers).toEqual([]);
  });
});

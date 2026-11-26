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
import { injectDayReview } from './day-review';

vi.mock('@ethlete/timetrack', async (original) => {
  const actual = await original<typeof timetrack>();

  return { ...actual, streamDay: vi.fn(actual.streamDay) };
});

describe('an idle past day', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 10, 18, 15, 0) }));
  afterEach(() => vi.useRealTimers());

  it('builds its streams once while the collectors keep draining', async () => {
    const ports = createFakePorts();

    vi.setSystemTime(new Date(2026, 10, 19, 10, 0));

    const injector = createEnvironmentInjector(
      [
        { provide: ɵINJECTOR_SCOPE, useValue: 'root' },
        provideZonelessChangeDetection(),
        { provide: HOST_PORTS, useValue: ports },
      ],
      Injector.NULL as EnvironmentInjector,
    );
    const app = injector.get(ApplicationRef);
    const review = runInInjectionContext(injector, () => injectDayReview());
    const settle = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      app.tick();
      review.day();
    };

    review.goToDay('2026-11-18');
    await settle(1_000);

    expect(review.day()?.rows).toBeTruthy();

    const built = vi.mocked(timetrack.streamDay).mock.calls.length;

    for (let second = 0; second < 120; second++) await settle(1_000);

    expect(vi.mocked(timetrack.streamDay).mock.calls.length).toBe(built);

    injector.destroy();
  });
});

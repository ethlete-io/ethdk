import { EnvironmentInjector, Injector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { injectUpdateCheck, UPDATE_CHECK_INTERVAL_MS } from './update-check';

vi.mock('@ethlete/core', () => ({
  defineRootProvider: <T>(factory: () => T) => factory,
  toInjectFn: <T>(factory: () => T) => factory,
}));

const ready = vi.hoisted(() => ({ next: vi.fn<() => unknown>() }));

vi.mock('../host/update', () => ({
  updateReady$: () => ready.next() as Observable<string | null>,
}));

const setup = () => {
  const injector = createEnvironmentInjector([], Injector.NULL as EnvironmentInjector);

  return runInInjectionContext(injector, () => injectUpdateCheck());
};

describe('injectUpdateCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ready.next.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('checks at start and again every 30 minutes until a release is ready', () => {
    ready.next.mockReturnValue(of(null));
    const update = setup();

    vi.advanceTimersByTime(0);
    expect(ready.next).toHaveBeenCalledTimes(1);
    expect(update.state()).toBe('current');

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(ready.next).toHaveBeenCalledTimes(2);

    ready.next.mockReturnValue(of('1.2.3'));
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(update.version()).toBe('1.2.3');

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2);
    expect(ready.next).toHaveBeenCalledTimes(3);
  });

  it('checks on request and reports a failure', () => {
    ready.next.mockReturnValue(of(null));
    const update = setup();
    vi.advanceTimersByTime(0);

    ready.next.mockReturnValue(throwError(() => new Error('offline')));
    update.check();

    expect(ready.next).toHaveBeenCalledTimes(2);
    expect(update.state()).toBe('failed');
  });
});

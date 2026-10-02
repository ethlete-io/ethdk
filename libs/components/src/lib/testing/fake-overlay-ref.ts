import { Provider, signal } from '@angular/core';
import { OverlayRuntimeCloseEvent, OverlayRuntimeCloseSource } from '@ethlete/core';
import { ReplaySubject, map } from 'rxjs';
import { OverlayConfig } from '../overlay/overlay-config';
import { OVERLAY_REF, OverlayCloseGuard, OverlayRef } from '../overlay/overlay-ref';

export type TestOverlayRef<TComponent extends object = object, TResult = unknown> = OverlayRef<TComponent, TResult> & {
  /** Every `close()` / `forceClose()` call, in order, including ones a close guard vetoed. */
  readonly closeCalls: readonly { result: TResult | undefined; source: OverlayRuntimeCloseSource; forced: boolean }[];
  /** Whether a close got past the close guards. */
  readonly isClosed: () => boolean;
};

/**
 * A standalone `OverlayRef` for unit-testing an overlay component without opening it: `close(result)`
 * runs the registered close guards, records the call and emits `beforeClosed` / `afterClosed`
 * (replayed, so a late subscriber still sees the result). Pair it with {@link provideTestOverlayRef}.
 *
 * @example
 * const ref = createTestOverlayRef<ProductResult>();
 * TestBed.configureTestingModule({ providers: [provideTestOverlayRef(ref)] });
 * // … press the component's save button …
 * expect(ref.closeCalls.at(-1)?.result).toEqual({ saved: true });
 */
export const createTestOverlayRef = <TResult = unknown, TComponent extends object = object>(
  config: OverlayConfig = {},
): TestOverlayRef<TComponent, TResult> => {
  const closeCalls: { result: TResult | undefined; source: OverlayRuntimeCloseSource; forced: boolean }[] = [];
  const closeGuards = new Set<OverlayCloseGuard<TResult>>();
  const closed = signal(false);
  const afterOpened$ = new ReplaySubject<void>(1);
  const beforeClosed$ = new ReplaySubject<OverlayRuntimeCloseEvent<TResult | undefined>>(1);
  const afterClosed$ = new ReplaySubject<OverlayRuntimeCloseEvent<TResult | undefined>>(1);

  afterOpened$.next();
  afterOpened$.complete();

  const requestClose = (result: TResult | undefined, source: OverlayRuntimeCloseSource, forced: boolean) => {
    closeCalls.push({ result, source, forced });

    if (closed()) return;

    const event = { result, source };

    if (!forced && [...closeGuards].some((guard) => !guard(event))) return;

    closed.set(true);
    beforeClosed$.next(event);
    beforeClosed$.complete();
    afterClosed$.next(event);
    afterClosed$.complete();
  };

  const mapResult = (subject: ReplaySubject<OverlayRuntimeCloseEvent<TResult | undefined>>) =>
    subject.pipe(map((event) => event.result));

  return {
    id: config.id ?? 'et-test-overlay',
    elements: null,
    config,
    headerTemplate: signal(null).asReadonly(),
    componentInstance: () => null,
    close: (result) => requestClose(result, 'api', false),
    forceClose: (result, source = 'api') => requestClose(result, source, true),
    registerCloseGuard: (guard) => {
      closeGuards.add(guard);

      return () => closeGuards.delete(guard);
    },
    updatePositionStrategy: () => undefined,
    afterOpened: () => afterOpened$.asObservable(),
    beforeClosed: () => mapResult(beforeClosed$),
    beforeClosedEvent: () => beforeClosed$.asObservable(),
    afterClosed: () => mapResult(afterClosed$),
    afterClosedEvent: () => afterClosed$.asObservable(),
    closeCalls,
    isClosed: closed.asReadonly(),
  };
};

/** Provides `ref` (a fresh {@link createTestOverlayRef} by default) as `OVERLAY_REF`, so `definition.injectRef()` resolves it. */
export const provideTestOverlayRef = <TResult = unknown>(
  ref: TestOverlayRef<object, TResult> = createTestOverlayRef<TResult>(),
): Provider[] => [{ provide: OVERLAY_REF, useValue: ref }];

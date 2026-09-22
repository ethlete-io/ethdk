import { InjectionToken, TemplateRef, computed, signal } from '@angular/core';
import {
  OverlayRuntimeCloseEvent,
  OverlayRuntimeCloseGuard,
  OverlayRuntimeCloseSource,
  OverlayRuntimePositionStrategy,
  OverlayRuntimeRef,
} from '@ethlete/core';
import { Observable, Subject, take, tap } from 'rxjs';
import { OverlayConfig } from './overlay-config';

/** A synchronous veto for a pending overlay close - see {@link OverlayRuntimeCloseGuard}. */
export type OverlayCloseGuard<TResult = unknown> = OverlayRuntimeCloseGuard<TResult | undefined>;

export const createOverlayRef = <TComponent extends object, TResult = unknown>(config: OverlayConfig) => {
  let id = '';
  let _runtimeRef: OverlayRuntimeRef<TComponent, TResult> | null = null;
  let _componentInstanceOverride: (() => TComponent | null) | null = null;

  const _headerTemplates = signal<TemplateRef<unknown>[]>([]);
  const headerTemplate = computed(() => _headerTemplates().at(-1) ?? null);

  const afterOpened$ = new Subject<void>();
  const beforeClosed$ = new Subject<TResult | undefined>();
  const beforeClosedEvent$ = new Subject<OverlayRuntimeCloseEvent<TResult | undefined>>();
  const afterClosed$ = new Subject<TResult | undefined>();
  const afterClosedEvent$ = new Subject<OverlayRuntimeCloseEvent<TResult | undefined>>();
  // Guards live here (not on the runtime ref directly) because the mounted component - where a guard
  // is registered - is constructed before `attachRuntime` runs. A single aggregate guard is wired to
  // the runtime ref on attach and reads this set live, so guards registered either side of attach work.
  const closeGuards = new Set<OverlayCloseGuard<TResult>>();

  const componentInstance = () => {
    if (_componentInstanceOverride) {
      return _componentInstanceOverride();
    }

    return _runtimeRef?.componentInstance() ?? null;
  };

  const elements = () => {
    return _runtimeRef?.elements ?? null;
  };

  const close = (result?: TResult) => {
    _runtimeRef?.close(result);
  };

  /**
   * Re-applies positioning with a new strategy in place, without remounting the overlay.
   * Note: a strategy-controller breakpoint switch will override this with its own strategy again.
   */
  const updatePositionStrategy = (strategy: OverlayRuntimePositionStrategy) => {
    _runtimeRef?.updatePositionStrategy(strategy);
  };

  /** @internal Close the overlay while reporting how the close was initiated. */
  const closeVia = (source: OverlayRuntimeCloseSource, result?: TResult) => {
    _runtimeRef?.close(result, source);
  };

  /**
   * Register a synchronous veto for pending closes. Return `false` from the guard to keep the
   * overlay open. An async decision (e.g. a confirm dialog) belongs in the guard's owner, which
   * re-issues the close via {@link forceClose} once resolved. Returns an unregister function.
   */
  const registerCloseGuard = (guard: OverlayCloseGuard<TResult>): (() => void) => {
    closeGuards.add(guard);

    return () => closeGuards.delete(guard);
  };

  /** Close the overlay bypassing every registered close guard - used to commit a close a guard
   *  previously vetoed (e.g. after an async confirm resolved). */
  const forceClose = (source: OverlayRuntimeCloseSource = 'api', result?: TResult) => {
    _runtimeRef?.forceClose(result, source);
  };

  /** @internal Reroutes `componentInstance` to the content component when a container is mounted. */
  const attachComponentInstanceOverride = (getter: () => TComponent | null) => {
    _componentInstanceOverride = getter;
  };

  const afterOpened = (): Observable<void> => {
    return afterOpened$.asObservable();
  };

  const beforeClosed = (): Observable<TResult | undefined> => {
    return beforeClosed$.asObservable();
  };

  /** Like `beforeClosed`, but also reports how the close was initiated. */
  const beforeClosedEvent = (): Observable<OverlayRuntimeCloseEvent<TResult | undefined>> => {
    return beforeClosedEvent$.asObservable();
  };

  const afterClosed = (): Observable<TResult | undefined> => {
    return afterClosed$.asObservable();
  };

  /** Like `afterClosed`, but also reports how the close was initiated (`escape`,
   *  `outside-pointer`, `api`, …) - e.g. to restore focus on an explicit dismiss without
   *  stealing it from whatever an outside-pointer close was aimed at. */
  const afterClosedEvent = (): Observable<OverlayRuntimeCloseEvent<TResult | undefined>> => {
    return afterClosedEvent$.asObservable();
  };

  const attachRuntime = (runtimeRef: OverlayRuntimeRef<TComponent, TResult>) => {
    _runtimeRef = runtimeRef;
    id = runtimeRef.id;

    // One aggregate guard, reading the live set - any single guard vetoing vetoes the close.
    runtimeRef.registerCloseGuard((event) => {
      for (const guard of closeGuards) {
        if (!guard(event)) {
          return false;
        }
      }

      return true;
    });

    runtimeRef
      .afterOpened()
      .pipe(
        take(1),
        tap(() => {
          afterOpened$.next();
          afterOpened$.complete();
        }),
      )
      .subscribe();

    runtimeRef
      .beforeClosed()
      .pipe(
        take(1),
        tap((event) => {
          beforeClosed$.next(event.result);
          beforeClosed$.complete();
          beforeClosedEvent$.next(event);
          beforeClosedEvent$.complete();
        }),
      )
      .subscribe();

    runtimeRef
      .afterClosed()
      .pipe(
        take(1),
        tap((event) => {
          afterClosed$.next(event.result);
          afterClosed$.complete();
          afterClosedEvent$.next(event);
          afterClosedEvent$.complete();
        }),
      )
      .subscribe();
  };

  return {
    get id() {
      return id;
    },
    get elements() {
      return elements();
    },

    config,

    headerTemplate,
    /**
     * @internal Registers a header template and returns its unregister function. The latest
     * registration still alive is the active one.
     */
    registerHeaderTemplate: (template: TemplateRef<unknown>) => {
      _headerTemplates.update((templates) => [...templates.filter((t) => t !== template), template]);

      return () => _headerTemplates.update((templates) => templates.filter((t) => t !== template));
    },

    componentInstance,
    close,
    closeVia,
    registerCloseGuard,
    forceClose,
    updatePositionStrategy,
    attachComponentInstanceOverride,
    afterOpened,
    beforeClosed,
    beforeClosedEvent,
    afterClosed,
    afterClosedEvent,
    attachRuntime,
  };
};

export type OverlayRef<TComponent extends object = object, TResult = unknown> = ReturnType<
  typeof createOverlayRef<TComponent, TResult>
>;

export const OVERLAY_REF = new InjectionToken<OverlayRef>('OverlayRef');

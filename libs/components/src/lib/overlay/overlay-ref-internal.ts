import { TemplateRef, computed, signal } from '@angular/core';
import { OverlayRuntimeCloseEvent, OverlayRuntimeCloseSource, OverlayRuntimeRef } from '@ethlete/core';
import { Subject, take, tap } from 'rxjs';
import { OverlayConfig } from './overlay-config';
import { OverlayCloseGuard, OverlayRef } from './overlay-ref';

export type OverlayRefInternals<TComponent extends object = object, TResult = unknown> = {
  attachRuntime: (runtimeRef: OverlayRuntimeRef<TComponent, TResult>) => void;
  attachComponentInstanceOverride: (getter: () => TComponent | null) => void;
  closeVia: (source: OverlayRuntimeCloseSource, result?: TResult) => void;
  registerHeaderTemplate: (template: TemplateRef<unknown>) => () => void;
  /** The result every close without one reports instead of `undefined`. */
  setDismissResult: (result: TResult) => void;
};

const INTERNALS = /* @__PURE__ */ new WeakMap<object, OverlayRefInternals<object, unknown>>();

/** `null` for a ref this module did not create, e.g. a test fake. */
export const getOverlayRefInternals = <TComponent extends object = object, TResult = unknown>(
  ref: OverlayRef<TComponent, TResult> | null | undefined,
) => (ref ? ((INTERNALS.get(ref) ?? null) as OverlayRefInternals<TComponent, TResult> | null) : null);

export const createOverlayRef = <TComponent extends object, TResult = unknown>(config: OverlayConfig) => {
  let id = '';
  let _runtimeRef: OverlayRuntimeRef<TComponent, TResult> | null = null;
  let _componentInstanceOverride: (() => TComponent | null) | null = null;
  let dismissResult: TResult | undefined;

  const _headerTemplates = signal<TemplateRef<unknown>[]>([]);
  const headerTemplate = computed(() => _headerTemplates().at(-1) ?? null);

  const afterOpened$ = new Subject<void>();
  const beforeClosed$ = new Subject<TResult | undefined>();
  const beforeClosedEvent$ = new Subject<OverlayRuntimeCloseEvent<TResult | undefined>>();
  const afterClosed$ = new Subject<TResult | undefined>();
  const afterClosedEvent$ = new Subject<OverlayRuntimeCloseEvent<TResult | undefined>>();
  const closeGuards = new Set<OverlayCloseGuard<TResult>>();

  const withDismissResult = (event: OverlayRuntimeCloseEvent<TResult | undefined>) =>
    event.result === undefined && dismissResult !== undefined ? { ...event, result: dismissResult } : event;

  const attachRuntime = (runtimeRef: OverlayRuntimeRef<TComponent, TResult>) => {
    _runtimeRef = runtimeRef;
    id = runtimeRef.id;

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
        tap((rawEvent) => {
          const event = withDismissResult(rawEvent);

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
        tap((rawEvent) => {
          const event = withDismissResult(rawEvent);

          afterClosed$.next(event.result);
          afterClosed$.complete();
          afterClosedEvent$.next(event);
          afterClosedEvent$.complete();
        }),
      )
      .subscribe();
  };

  const ref: OverlayRef<TComponent, TResult> = {
    get id() {
      return id;
    },
    get elements() {
      return _runtimeRef?.elements ?? null;
    },
    config,
    headerTemplate,
    componentInstance: () => {
      if (_componentInstanceOverride) {
        return _componentInstanceOverride();
      }

      return _runtimeRef?.componentInstance() ?? null;
    },
    close: (result) => _runtimeRef?.close(result),
    registerCloseGuard: (guard) => {
      closeGuards.add(guard);

      return () => closeGuards.delete(guard);
    },
    forceClose: (result, source = 'api') => _runtimeRef?.forceClose(result, source),
    updatePositionStrategy: (strategy) => _runtimeRef?.updatePositionStrategy(strategy),
    afterOpened: () => afterOpened$.asObservable(),
    beforeClosed: () => beforeClosed$.asObservable(),
    beforeClosedEvent: () => beforeClosedEvent$.asObservable(),
    afterClosed: () => afterClosed$.asObservable(),
    afterClosedEvent: () => afterClosedEvent$.asObservable(),
  };

  const internals: OverlayRefInternals<TComponent, TResult> = {
    attachRuntime,
    attachComponentInstanceOverride: (getter) => {
      _componentInstanceOverride = getter;
    },
    closeVia: (source, result) => _runtimeRef?.close(result, source),
    registerHeaderTemplate: (template) => {
      _headerTemplates.update((templates) => [...templates.filter((t) => t !== template), template]);

      return () => _headerTemplates.update((templates) => templates.filter((t) => t !== template));
    },
    setDismissResult: (result) => {
      dismissResult = result;
    },
  };

  INTERNALS.set(ref, internals as OverlayRefInternals<object, unknown>);

  return { ref, internals };
};

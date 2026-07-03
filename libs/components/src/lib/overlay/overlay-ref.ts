import { InjectionToken, TemplateRef, signal } from '@angular/core';
import { OverlayRuntimeCloseSource, OverlayRuntimeRef } from '@ethlete/core';
import { Observable, Subject, take, tap } from 'rxjs';
import { OverlayConfig } from './overlay-config';

export const createOverlayRef = <TComponent extends object, TResult = unknown>(config: OverlayConfig) => {
  let id = '';
  let _runtimeRef: OverlayRuntimeRef<TComponent, TResult> | null = null;
  let _componentInstanceOverride: (() => TComponent | null) | null = null;

  const _headerTemplate = signal<TemplateRef<unknown> | null>(null);

  const afterOpened$ = new Subject<void>();
  const beforeClosed$ = new Subject<TResult | undefined>();
  const afterClosed$ = new Subject<TResult | undefined>();

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

  /** @internal Close the overlay while reporting how the close was initiated. */
  const closeVia = (source: OverlayRuntimeCloseSource, result?: TResult) => {
    _runtimeRef?.close(result, source);
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

  const afterClosed = (): Observable<TResult | undefined> => {
    return afterClosed$.asObservable();
  };

  const attachRuntime = (runtimeRef: OverlayRuntimeRef<TComponent, TResult>) => {
    _runtimeRef = runtimeRef;
    id = runtimeRef.id;

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

    headerTemplate: _headerTemplate.asReadonly(),
    /** @internal Set (or clear) the active header template. */
    setHeaderTemplate: (template: TemplateRef<unknown> | null) => _headerTemplate.set(template),

    componentInstance,
    close,
    closeVia,
    attachComponentInstanceOverride,
    afterOpened,
    beforeClosed,
    afterClosed,
    attachRuntime,
  };
};

export type OverlayRef<TComponent extends object = object, TResult = unknown> = ReturnType<
  typeof createOverlayRef<TComponent, TResult>
>;

export const OVERLAY_REF = new InjectionToken<OverlayRef>('OverlayRef');

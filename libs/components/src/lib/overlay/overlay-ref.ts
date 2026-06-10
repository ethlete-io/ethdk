import { InjectionToken } from '@angular/core';
import { OverlayRuntimeRef } from '@ethlete/core';
import { Observable, Subject, take, tap } from 'rxjs';
import { OverlayConfig } from './overlay-config';

export const createOverlayRef = <TComponent extends object, TResult = unknown>(config: OverlayConfig) => {
  let _id = '';
  let _runtimeRef: OverlayRuntimeRef<TComponent, TResult> | null = null;

  const afterOpened$ = new Subject<void>();
  const beforeClosed$ = new Subject<TResult | undefined>();
  const afterClosed$ = new Subject<TResult | undefined>();

  return {
    get id() {
      return _id;
    },
    config,

    get componentInstance(): TComponent | null {
      return _runtimeRef?.componentInstance() ?? null;
    },

    close(result?: TResult) {
      _runtimeRef?.close(result);
    },

    afterOpened(): Observable<void> {
      return afterOpened$.asObservable();
    },

    beforeClosed(): Observable<TResult | undefined> {
      return beforeClosed$.asObservable();
    },

    afterClosed(): Observable<TResult | undefined> {
      return afterClosed$.asObservable();
    },

    attachRuntime(runtimeRef: OverlayRuntimeRef<TComponent, TResult>) {
      _runtimeRef = runtimeRef;
      _id = runtimeRef.id;

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
    },
  };
};

export type OverlayRef<TComponent extends object = object, TResult = unknown> = ReturnType<
  typeof createOverlayRef<TComponent, TResult>
>;

export const OVERLAY_REF = new InjectionToken<OverlayRef>('OverlayRef');

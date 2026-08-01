import { ComponentRef, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  OverlayRuntimeCloseEvent,
  OverlayRuntimeCloseGuard,
  OverlayRuntimeCloseSource,
  OverlayRuntimeElements,
  OverlayRuntimeMountConfig,
  OverlayRuntimePositionStrategy,
} from './overlay-runtime.types';

export type OverlayRuntimeState = 'mounting' | 'mounted' | 'closing' | 'closed';

export const createOverlayRuntimeRef = <TComponent extends object, TResult = unknown>(
  id: string,
  config: Omit<OverlayRuntimeMountConfig<TComponent>, 'component'>,
  elements: OverlayRuntimeElements,
  requestClose: (result: TResult | undefined, source: OverlayRuntimeCloseSource) => void,
) => {
  const _state = signal<OverlayRuntimeState>('mounting');
  const _componentInstance = signal<TComponent | null>(null);

  let positionUpdater: ((strategy: OverlayRuntimePositionStrategy) => void) | null = null;

  const beforeOpenedSubject = new Subject<void>();
  const afterOpenedSubject = new Subject<void>();
  const beforeClosedSubject = new Subject<OverlayRuntimeCloseEvent<TResult>>();
  const afterClosedSubject = new Subject<OverlayRuntimeCloseEvent<TResult>>();
  const closeGuards = new Set<OverlayRuntimeCloseGuard<TResult>>();

  return {
    id,
    config,
    elements,
    state: _state.asReadonly(),
    componentInstance: _componentInstance.asReadonly(),

    // Internal - driven by overlay-runtime.ts
    beforeOpenedSubject,

    close(result?: TResult, source: OverlayRuntimeCloseSource = 'api') {
      if (_state() === 'closing' || _state() === 'closed') {
        return;
      }

      // `reference-detached` is a forced teardown (the anchor is gone) - never vetoable.
      if (source !== 'reference-detached') {
        for (const guard of closeGuards) {
          if (!guard({ result, source })) {
            return;
          }
        }
      }

      requestClose(result, source);
    },

    /** Close bypassing every registered close guard - used by a guard's owner to commit a
     *  close it previously vetoed (e.g. after an async confirm resolved). */
    forceClose(result?: TResult, source: OverlayRuntimeCloseSource = 'api') {
      if (_state() === 'closing' || _state() === 'closed') {
        return;
      }

      requestClose(result, source);
    },

    /** Register a synchronous veto for pending closes. Returns an unregister function. */
    registerCloseGuard(guard: OverlayRuntimeCloseGuard<TResult>): () => void {
      closeGuards.add(guard);

      return () => closeGuards.delete(guard);
    },

    beforeOpened(): Observable<void> {
      return beforeOpenedSubject.asObservable();
    },
    afterOpened(): Observable<void> {
      return afterOpenedSubject.asObservable();
    },
    beforeClosed(): Observable<OverlayRuntimeCloseEvent<TResult>> {
      return beforeClosedSubject.asObservable();
    },
    afterClosed(): Observable<OverlayRuntimeCloseEvent<TResult>> {
      return afterClosedSubject.asObservable();
    },

    attachComponentRef(componentRef: ComponentRef<TComponent>) {
      _componentInstance.set(componentRef.instance);
    },

    /** @internal */
    attachPositionUpdater(updater: (strategy: OverlayRuntimePositionStrategy) => void) {
      positionUpdater = updater;
    },

    updatePositionStrategy(strategy: OverlayRuntimePositionStrategy) {
      if (_state() === 'closing' || _state() === 'closed') {
        return;
      }

      positionUpdater?.(strategy);
    },

    markOpened() {
      if (_state() !== 'mounting') {
        return;
      }

      _state.set('mounted');
      afterOpenedSubject.next();
      afterOpenedSubject.complete();
    },

    beginClose(closeEvent: OverlayRuntimeCloseEvent<TResult>) {
      if (_state() === 'closing' || _state() === 'closed') {
        return false;
      }

      _state.set('closing');
      beforeClosedSubject.next(closeEvent);
      beforeClosedSubject.complete();

      return true;
    },

    finishClose(closeEvent: OverlayRuntimeCloseEvent<TResult>) {
      if (_state() === 'closed') {
        return;
      }

      _state.set('closed');
      _componentInstance.set(null);
      afterClosedSubject.next(closeEvent);
      afterClosedSubject.complete();
    },
  };
};

export type OverlayRuntimeRef<TComponent extends object = object, TResult = unknown> = ReturnType<
  typeof createOverlayRuntimeRef<TComponent, TResult>
>;

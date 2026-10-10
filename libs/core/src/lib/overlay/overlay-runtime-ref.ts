import { ComponentRef, Signal, signal } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
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
  let backdropUpdater: ((hasBackdrop: boolean) => void) | null = null;

  const beforeOpenedSubject = new ReplaySubject<void>(1);
  const afterOpenedSubject = new ReplaySubject<void>(1);
  const beforeClosedSubject = new ReplaySubject<OverlayRuntimeCloseEvent<TResult>>(1);
  const afterClosedSubject = new ReplaySubject<OverlayRuntimeCloseEvent<TResult>>(1);
  const closeGuards = new Set<OverlayRuntimeCloseGuard<TResult>>();

  return {
    id,
    config,
    elements,
    state: _state.asReadonly(),
    componentInstance: _componentInstance.asReadonly(),

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

    markBeforeOpened() {
      beforeOpenedSubject.next();
      beforeOpenedSubject.complete();
    },

    attachPositionUpdater(updater: (strategy: OverlayRuntimePositionStrategy) => void) {
      positionUpdater = updater;
    },

    updatePositionStrategy(strategy: OverlayRuntimePositionStrategy) {
      if (_state() === 'closing' || _state() === 'closed') {
        return;
      }

      positionUpdater?.(strategy);
    },

    attachBackdropUpdater(updater: (hasBackdrop: boolean) => void) {
      backdropUpdater = updater;
    },

    /**
     * Adds or removes the backdrop of an open overlay. `elements.backdropElement` follows.
     * A closing overlay keeps the backdrop it has, so its leave transition stays intact.
     */
    updateBackdrop(hasBackdrop: boolean) {
      if (_state() === 'closing' || _state() === 'closed') {
        return;
      }

      backdropUpdater?.(hasBackdrop);
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
      afterOpenedSubject.complete();
      afterClosedSubject.next(closeEvent);
      afterClosedSubject.complete();
    },
  };
};

export type OverlayRuntimeRefInternal<TComponent extends object = object, TResult = unknown> = ReturnType<
  typeof createOverlayRuntimeRef<TComponent, TResult>
>;

/**
 * The handle `OverlayRuntime.mount()` returns. The lifecycle observables replay their event, so a
 * subscriber that arrives after it still gets one emission.
 */
export type OverlayRuntimeRef<TComponent extends object = object, TResult = unknown> = {
  readonly id: string;
  readonly config: Omit<OverlayRuntimeMountConfig<TComponent>, 'component'>;
  readonly elements: OverlayRuntimeElements;
  readonly state: Signal<OverlayRuntimeState>;
  readonly componentInstance: Signal<TComponent | null>;
  close(result?: TResult, source?: OverlayRuntimeCloseSource): void;
  /** Closes while bypassing every registered close guard, e.g. to commit a close a guard vetoed earlier. */
  forceClose(result?: TResult, source?: OverlayRuntimeCloseSource): void;
  /** Registers a synchronous veto for pending closes. Returns an unregister function. */
  registerCloseGuard(guard: OverlayRuntimeCloseGuard<TResult>): () => void;
  beforeOpened(): Observable<void>;
  afterOpened(): Observable<void>;
  beforeClosed(): Observable<OverlayRuntimeCloseEvent<TResult>>;
  afterClosed(): Observable<OverlayRuntimeCloseEvent<TResult>>;
  updatePositionStrategy(strategy: OverlayRuntimePositionStrategy): void;
  /** Adds or removes the backdrop of an open overlay. A closing overlay keeps the backdrop it has. */
  updateBackdrop(hasBackdrop: boolean): void;
};

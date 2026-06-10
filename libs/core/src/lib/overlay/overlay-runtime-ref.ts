import { ComponentRef, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  OverlayRuntimeCloseEvent,
  OverlayRuntimeCloseSource,
  OverlayRuntimeElements,
  OverlayRuntimeMountConfig,
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

  const beforeOpenedSubject = new Subject<void>();
  const afterOpenedSubject = new Subject<void>();
  const beforeClosedSubject = new Subject<OverlayRuntimeCloseEvent<TResult>>();
  const afterClosedSubject = new Subject<OverlayRuntimeCloseEvent<TResult>>();

  return {
    id,
    config,
    elements,
    state: _state.asReadonly(),
    componentInstance: _componentInstance.asReadonly(),

    // Internal — driven by overlay-runtime.ts
    beforeOpenedSubject,

    close(result?: TResult, source: OverlayRuntimeCloseSource = 'api') {
      if (_state() === 'closing' || _state() === 'closed') {
        return;
      }

      requestClose(result, source);
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

    markOpened() {
      if (_state() !== 'mounting') {
        return;
      }

      _state.set('mounted');
      afterOpenedSubject.next();
      afterOpenedSubject.complete();
    },

    beginClose(closeEvent: OverlayRuntimeCloseEvent<TResult>): boolean {
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

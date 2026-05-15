import { ComponentRef, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  OverlayRuntimeCloseEvent,
  OverlayRuntimeCloseSource,
  OverlayRuntimeElements,
  OverlayRuntimeMountConfig,
} from './overlay-runtime.types';

export type OverlayRuntimeState = 'mounting' | 'mounted' | 'closing' | 'closed';

export class OverlayRuntimeRef<TComponent extends object = object, TResult = unknown> {
  componentInstance: TComponent | null = null;
  componentRef: ComponentRef<TComponent> | null = null;

  readonly state = signal<OverlayRuntimeState>('mounting');

  beforeOpenedSubject = new Subject<void>();
  afterOpenedSubject = new Subject<void>();
  beforeClosedSubject = new Subject<OverlayRuntimeCloseEvent<TResult>>();
  afterClosedSubject = new Subject<OverlayRuntimeCloseEvent<TResult>>();

  constructor(
    readonly id: string,
    readonly config: Omit<OverlayRuntimeMountConfig<TComponent>, 'component'>,
    readonly elements: OverlayRuntimeElements,
    private requestClose: (result: TResult | undefined, source: OverlayRuntimeCloseSource) => void,
  ) {}

  close(result?: TResult, source: OverlayRuntimeCloseSource = 'api') {
    if (this.state() === 'closing' || this.state() === 'closed') {
      return;
    }

    this.requestClose(result, source);
  }

  beforeOpened(): Observable<void> {
    return this.beforeOpenedSubject.asObservable();
  }

  afterOpened(): Observable<void> {
    return this.afterOpenedSubject.asObservable();
  }

  beforeClosed(): Observable<OverlayRuntimeCloseEvent<TResult>> {
    return this.beforeClosedSubject.asObservable();
  }

  afterClosed(): Observable<OverlayRuntimeCloseEvent<TResult>> {
    return this.afterClosedSubject.asObservable();
  }

  attachComponentRef(componentRef: ComponentRef<TComponent>) {
    this.componentRef = componentRef;
    this.componentInstance = componentRef.instance;
  }

  markOpened() {
    if (this.state() !== 'mounting') {
      return;
    }

    this.state.set('mounted');
    this.afterOpenedSubject.next();
    this.afterOpenedSubject.complete();
  }

  beginClose(closeEvent: OverlayRuntimeCloseEvent<TResult>) {
    if (this.state() === 'closing' || this.state() === 'closed') {
      return false;
    }

    this.state.set('closing');
    this.beforeClosedSubject.next(closeEvent);
    this.beforeClosedSubject.complete();

    return true;
  }

  finishClose(closeEvent: OverlayRuntimeCloseEvent<TResult>) {
    if (this.state() === 'closed') {
      return;
    }

    this.state.set('closed');
    this.componentInstance = null;
    this.componentRef = null;
    this.afterClosedSubject.next(closeEvent);
    this.afterClosedSubject.complete();
  }
}

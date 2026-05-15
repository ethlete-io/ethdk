import { ComponentRef } from '@angular/core';
import { OverlayRuntimeCloseEvent, OverlayRuntimeRef } from '@ethlete/core';
import { Observable, Subject, take, tap } from 'rxjs';
import { OverlayConfig } from './overlay-config';

export class OverlayRef<TComponent extends object = object, TResult = unknown> {
  componentInstance: TComponent | null = null;
  componentRef: ComponentRef<TComponent> | null = null;
  id = '';

  private runtimeRef: OverlayRuntimeRef<TComponent, TResult> | null = null;
  private afterOpened$ = new Subject<void>();
  private beforeClosed$ = new Subject<TResult | undefined>();
  private afterClosed$ = new Subject<TResult | undefined>();

  constructor(readonly config: OverlayConfig) {}

  close(result?: TResult, force = false) {
    void force;

    this.runtimeRef?.close(result);
  }

  afterOpened(): Observable<void> {
    return this.afterOpened$.asObservable();
  }

  beforeClosed(): Observable<TResult | undefined> {
    return this.beforeClosed$.asObservable();
  }

  afterClosed(): Observable<TResult | undefined> {
    return this.afterClosed$.asObservable();
  }

  attachRuntime(runtimeRef: OverlayRuntimeRef<TComponent, TResult>) {
    this.runtimeRef = runtimeRef;
    this.id = runtimeRef.id;
    this.componentRef = runtimeRef.componentRef;
    this.componentInstance = runtimeRef.componentInstance;

    runtimeRef
      .afterOpened()
      .pipe(
        take(1),
        tap(() => {
          this.componentRef = runtimeRef.componentRef;
          this.componentInstance = runtimeRef.componentInstance;
          this.afterOpened$.next();
          this.afterOpened$.complete();
        }),
      )
      .subscribe();

    runtimeRef
      .beforeClosed()
      .pipe(
        take(1),
        tap((event) => {
          this.beforeClosed$.next(event.result);
          this.beforeClosed$.complete();
        }),
      )
      .subscribe();

    runtimeRef
      .afterClosed()
      .pipe(
        take(1),
        tap((event) => {
          this.handleAfterClosed(event);
        }),
      )
      .subscribe();
  }

  private handleAfterClosed(event: OverlayRuntimeCloseEvent<TResult>) {
    this.componentInstance = null;
    this.componentRef = null;
    this.afterClosed$.next(event.result);
    this.afterClosed$.complete();
  }
}

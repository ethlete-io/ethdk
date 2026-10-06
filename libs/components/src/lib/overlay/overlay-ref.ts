import { InjectionToken, Signal, TemplateRef, WritableSignal } from '@angular/core';
import {
  OverlayRuntimeCloseEvent,
  OverlayRuntimeCloseGuard,
  OverlayRuntimeCloseSource,
  OverlayRuntimeElements,
  OverlayRuntimePositionStrategy,
} from '@ethlete/core';
import { Observable } from 'rxjs';
import { OverlayConfig } from './overlay-config';

/** A synchronous veto for a pending overlay close - see {@link OverlayRuntimeCloseGuard}. */
export type OverlayCloseGuard<TResult = unknown> = OverlayRuntimeCloseGuard<TResult | undefined>;

/** The handle to an open overlay, returned by an opener and injectable inside the overlay via `OVERLAY_REF`. */
export type OverlayRef<TComponent extends object = object, TResult = unknown> = {
  readonly id: string;
  readonly elements: OverlayRuntimeElements | null;
  readonly config: OverlayConfig;
  /** The header template registered by `etOverlayHeaderTemplate`, if any. */
  readonly headerTemplate: Signal<TemplateRef<unknown> | null>;
  componentInstance: () => TComponent | null;
  close: (result?: TResult) => void;
  /**
   * While `true`, every close source except `api` (`close()` / `forceClose()` from code) is blocked,
   * the pane reports `aria-busy="true"` and every `etOverlayClose` inside renders disabled.
   */
  busy: WritableSignal<boolean>;
  /**
   * Register a synchronous veto for pending closes. Return `false` from the guard to keep the
   * overlay open. An async decision (e.g. a confirm dialog) belongs in the guard's owner, which
   * re-issues the close via `forceClose` once resolved. Returns an unregister function.
   */
  registerCloseGuard: (guard: OverlayCloseGuard<TResult>) => () => void;
  /** Close the overlay bypassing every registered close guard, e.g. after an async confirm resolved. */
  forceClose: (result?: TResult, source?: OverlayRuntimeCloseSource) => void;
  /**
   * Re-applies positioning with a new strategy in place, without remounting the overlay.
   * A strategy-controller breakpoint switch overrides this with its own strategy again.
   */
  updatePositionStrategy: (strategy: OverlayRuntimePositionStrategy) => void;
  afterOpened: () => Observable<void>;
  beforeClosed: () => Observable<TResult | undefined>;
  /** Like `beforeClosed`, but also reports how the close was initiated. */
  beforeClosedEvent: () => Observable<OverlayRuntimeCloseEvent<TResult | undefined>>;
  afterClosed: () => Observable<TResult | undefined>;
  /**
   * Like `afterClosed`, but also reports how the close was initiated (`escape`, `outside-pointer`,
   * `api`, …) - e.g. to restore focus on an explicit dismiss without stealing it from whatever an
   * outside-pointer close was aimed at.
   */
  afterClosedEvent: () => Observable<OverlayRuntimeCloseEvent<TResult | undefined>>;
};

export const OVERLAY_REF = new InjectionToken<OverlayRef>('OverlayRef');

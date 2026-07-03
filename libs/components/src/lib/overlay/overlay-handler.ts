import {
  DestroyRef,
  EffectRef,
  Injector,
  Type,
  ViewContainerRef,
  WritableSignal,
  effect,
  inject,
  isSignal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { injectQueryParam } from '@ethlete/core';
import { tap } from 'rxjs';
import { OverlayConfig } from './overlay-config';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

export type CreateOverlayHandlerConfig<TComponent extends object> = OverlayConfig & {
  /** The overlay component. */
  component: Type<TComponent>;
};

/** Per-open config overrides. Strategies are fixed by the handler's root config. */
export type OverlayConsumerConfig = Omit<OverlayConfig, 'strategies'>;

export type OverlayHandler<TComponent extends object, TResult = unknown> = {
  /** Open the overlay using a combination of the given configs  */
  open: (config?: OverlayConsumerConfig) => OverlayRef<TComponent, TResult>;

  /**
   * Returns the typed overlay ref.
   * @throws Error if the overlay ref gets accessed outside of the overlay component
   */
  injectOverlayRef: () => OverlayRef<TComponent, TResult>;
};

export type CreateOverlayHandlerInnerConfig<TResult = unknown> = {
  /** A callback function to be executed once the overlay has been closed */
  afterClosed?: (result: TResult | null) => void;

  /** A callback function to be executed before the overlay is closed */
  beforeClosed?: (result: TResult | null) => void;

  /** A callback function to be executed once the overlay has been opened */
  afterOpened?: () => void;
};

export const createOverlayHandler = <TComponent extends object, TResult = unknown>(
  rootConfig: CreateOverlayHandlerConfig<TComponent>,
) => {
  const fn = (innerConfig?: CreateOverlayHandlerInnerConfig<TResult>) => {
    const overlayManager = injectOverlayManager();
    const viewContainerRef = rootConfig.viewContainerRef ?? inject(ViewContainerRef, { optional: true }) ?? undefined;
    const destroyRef = inject(DestroyRef);

    const { component, ...rootOverlayConfig } = rootConfig;

    const open = (config?: OverlayConsumerConfig) => {
      const ref = overlayManager.open<TComponent, TResult>(component, {
        viewContainerRef,
        ...rootOverlayConfig,
        ...config,
      });

      const afterClosedFn = innerConfig?.afterClosed;
      const beforeClosedFn = innerConfig?.beforeClosed;
      const afterOpenedFn = innerConfig?.afterOpened;

      if (afterClosedFn) {
        ref
          .afterClosed()
          .pipe(
            takeUntilDestroyed(destroyRef),
            tap((result) => afterClosedFn(result ?? null)),
          )
          .subscribe();
      }

      if (beforeClosedFn) {
        ref
          .beforeClosed()
          .pipe(
            takeUntilDestroyed(destroyRef),
            tap((result) => beforeClosedFn(result ?? null)),
          )
          .subscribe();
      }

      if (afterOpenedFn) {
        ref
          .afterOpened()
          .pipe(
            takeUntilDestroyed(destroyRef),
            tap(() => afterOpenedFn()),
          )
          .subscribe();
      }

      return ref;
    };

    const injectOverlayRef = () => {
      return inject(OVERLAY_REF) as OverlayRef<TComponent, TResult>;
    };

    const handler: OverlayHandler<TComponent, TResult> = {
      open,
      injectOverlayRef,
    };

    return handler;
  };

  return fn;
};

/** The name of the model the overlay component must expose to participate in query-param sync. */
export const OVERLAY_QUERY_PARAM_INPUT_NAME = 'overlayQueryParam';

export type OverlayHandlerWithQueryParamLifecycle<TQueryParam extends string = string> = {
  /** Open the overlay by writing the given value to the query param. */
  open: (value: TQueryParam) => void;

  /** Close the overlay by removing the query param. */
  close: () => void;
};

export type CreateOverlayHandlerWithQueryParamLifecycleConfig<TComponent extends object> =
  CreateOverlayHandlerConfig<TComponent> & {
    /** The query param key that drives this overlay's open/close lifecycle. */
    queryParamKey: string;
  };

const isWritableSignal = <T>(value: unknown): value is WritableSignal<T> =>
  isSignal(value) && typeof (value as { set?: unknown }).set === 'function';

/**
 * Drives an overlay's lifecycle from a URL query param: the overlay opens while the param is present
 * and closes (clearing the param) when dismissed. The param value is forwarded to the overlay via an
 * `overlayQueryParam` {@link https://angular.dev/api/core/model | model}, which is kept in two-way sync
 * with the URL — reading the model reflects the URL, and writing it updates the URL.
 *
 * Open it declaratively with {@link OverlayHandlerLinkDirective}, or imperatively via the returned
 * handler's `open()` / `close()`.
 *
 * @example
 * // in the overlay component:
 * readonly overlayQueryParam = model<string>();
 *
 * // once, in a long-lived component (e.g. AppComponent):
 * private handler = createProductOverlay(); // returned by this factory
 */
export const createOverlayHandlerWithQueryParamLifecycle = <
  TComponent extends object,
  TQueryParam extends string = string,
  TResult = unknown,
>(
  config: CreateOverlayHandlerWithQueryParamLifecycleConfig<TComponent>,
) => {
  const { queryParamKey, ...handlerConfig } = config;
  const baseHandler = createOverlayHandler<TComponent, TResult>(handlerConfig);

  const fn = (innerConfig?: CreateOverlayHandlerInnerConfig<TResult>) => {
    const router = inject(Router);
    const destroyRef = inject(DestroyRef);
    const injector = inject(Injector);
    const queryParamValue = injectQueryParam<TQueryParam>(queryParamKey);

    let overlayRef: OverlayRef<TComponent, TResult> | null = null;
    let modelSyncEffect: EffectRef | null = null;

    const updateQueryParam = (value: TQueryParam | null) =>
      router.navigate([], { queryParams: { [queryParamKey]: value }, queryParamsHandling: 'merge' });

    const queryParamModel = () => {
      const instance = overlayRef?.componentInstance() as Record<string, unknown> | null;

      return isWritableSignal<TQueryParam>(instance?.[OVERLAY_QUERY_PARAM_INPUT_NAME])
        ? (instance[OVERLAY_QUERY_PARAM_INPUT_NAME] as WritableSignal<TQueryParam>)
        : null;
    };

    const teardown = () => {
      modelSyncEffect?.destroy();
      modelSyncEffect = null;
    };

    // Lifecycle hooks run through the base handler (subscribed outside any effect), composed with
    // the consumer's own callbacks.
    const handler = baseHandler({
      ...innerConfig,
      afterOpened: () => {
        innerConfig?.afterOpened?.();

        const model = queryParamModel();
        if (!model) return;

        // Keep the URL in sync when the overlay writes to its model.
        modelSyncEffect = effect(
          () => {
            const modelValue = model();
            untracked(() => updateQueryParam(modelValue));
          },
          { injector },
        );
      },
      beforeClosed: (result) => {
        innerConfig?.beforeClosed?.(result);

        teardown();
        overlayRef = null;
        updateQueryParam(null);
      },
    });

    effect(() => {
      const value = queryParamValue();

      untracked(() => {
        if (!value) {
          overlayRef?.close();

          return;
        }

        if (overlayRef) {
          // The overlay is already open and the param changed externally — push it into the model.
          queryParamModel()?.set(value);

          return;
        }

        // Seed the initial value via inputBindings; two-way sync is wired up in afterOpened.
        overlayRef = handler.open({ inputBindings: { [OVERLAY_QUERY_PARAM_INPUT_NAME]: value } });
      });
    });

    destroyRef.onDestroy(() => {
      teardown();

      if (overlayRef) {
        updateQueryParam(null);
      }
    });

    const lifecycleHandler: OverlayHandlerWithQueryParamLifecycle<TQueryParam> = {
      open: (value) => updateQueryParam(value),
      close: () => updateQueryParam(null),
    };

    return lifecycleHandler;
  };

  fn.injectOverlayRef = () => inject(OVERLAY_REF) as OverlayRef<TComponent, TResult>;

  return fn;
};

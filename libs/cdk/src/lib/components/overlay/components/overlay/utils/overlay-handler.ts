import { ComponentType } from '@angular/cdk/overlay';
import {
  DestroyRef,
  effect,
  EffectRef,
  inject,
  Injector,
  InputSignal,
  ModelSignal,
  TemplateRef,
  untracked,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { injectQueryParam } from '@ethlete/core';
import { tap } from 'rxjs';
import { OVERLAY_DATA } from '../constants';
import { OverlayService } from '../services';
import { OverlayBreakpointConfigEntry, OverlayConfig, OverlayConsumerConfig } from '../types';
import { OverlayPositionBuilder } from './overlay-position-builder';
import { OverlayRef } from './overlay-ref';

export type CreateOverlayHandlerConfig<T, D = unknown> = Omit<OverlayConfig<D>, 'positions'> & {
  /** The overlay component. Use either this or the `template` property  */
  component?: ComponentType<T>;

  /** The overlay template. Use either this or the `component` property  */
  template?: TemplateRef<T>;

  /** The overlay positions using the position builder provided via argument  */
  positions: (builder: OverlayPositionBuilder) => OverlayBreakpointConfigEntry[];
};

export type OverlayHandler<T, D = unknown, R = unknown> = {
  /** Open the overlay using a combination of the given configs  */
  open: (config?: OverlayConsumerConfig<D>) => OverlayRef<T, R>;

  /**
   * Returns the typed overlay ref.
   * @throws Error if the overlay ref gets accessed outside of the overlay component or templateRef
   */
  injectOverlayRef: () => OverlayRef<T, R>;

  /**
   * Returns the overlay data.
   * @throws Error if the overlay data gets accessed outside of the overlay component or templateRef
   */
  injectOverlayData: () => D;
};

export type CreateOverlayHandlerInnerConfig<R = unknown> = {
  /** A callback function to be executed once the overlay has been closed */
  afterClosed?: (result: R | null) => void;

  /** A callback function to be executed before the overlay is closed */
  beforeClosed?: (result: R | null) => void;

  /** A callback function to be executed once the overlay has been opened */
  afterOpened?: () => void;
};

export const createOverlayHandler = <TComponent, TOverlayData = unknown, TOverlayResult = unknown>(
  rootConfig: CreateOverlayHandlerConfig<TComponent, TOverlayData>,
) => {
  const fn = (innerConfig?: CreateOverlayHandlerInnerConfig<TOverlayResult>) => {
    const overlayService = inject(OverlayService);
    const viewContainerRef = rootConfig.viewContainerRef ?? inject(ViewContainerRef, { optional: true }) ?? undefined;
    const destroyRef = inject(DestroyRef);

    const tpl = rootConfig.component ?? rootConfig.template;

    if (!tpl) {
      throw new Error('Either component or template must be provided');
    }

    const open = (config?: OverlayConsumerConfig<TOverlayData>) => {
      const ref = overlayService.open<TComponent, TOverlayData, TOverlayResult>(tpl, {
        viewContainerRef,
        ...rootConfig,
        positions: rootConfig.positions(overlayService.positions),
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
            tap((r) => afterClosedFn(r ?? null)),
          )
          .subscribe();
      }

      if (beforeClosedFn) {
        ref
          .beforeClosed()
          .pipe(
            takeUntilDestroyed(destroyRef),
            tap((r) => beforeClosedFn(r ?? null)),
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
      return inject<OverlayRef<TComponent, TOverlayResult>>(OverlayRef);
    };

    const injectOverlayData = () => {
      return inject<TOverlayData>(OVERLAY_DATA);
    };

    const handler: OverlayHandler<TComponent, TOverlayData, TOverlayResult> = {
      open,
      injectOverlayRef,
      injectOverlayData,
    };

    return handler;
  };

  return fn;
};

export type OverlayHandlerWithQueryParamLifecycle<Q = string> = {
  /** Open the overlay using the provided query param value  */
  open: (queryParamValue: Q) => void;

  /** Close the overlay and remove the query param  */
  close: () => void;
};

export type CreateOverlayHandlerWithQueryParamLifecycleConfig<T> = Omit<
  OverlayConfig<unknown>,
  'positions' | 'data' | 'closeOnNavigation'
> & {
  /** The overlay component  */
  component: ComponentType<T>;

  /** The overlay positions using the position builder provided via argument  */
  positions: (builder: OverlayPositionBuilder) => OverlayBreakpointConfigEntry[];

  /** The query param key to be used for the overlay  */
  queryParamKey: string;
};

export const OVERLAY_QUERY_PARAM_INPUT_NAME = 'overlayQueryParam';

/**
 * This handler will automatically open the overlay when the query param is present.
 * The overlay can contain a input or model with the name `overlayQueryParam` to receive the query param value.
 *
 * If you need to transfer more information (eg. a second query param), you need to combine them into a single query param string.
 * You can then split the string inside the overlay component using computed signals.
 *
 * To open the overlay either use the `OverlayHandlerLinkDirective` or call the `.open` method of the returned handler.
 */
export const createOverlayHandlerWithQueryParamLifecycle = <
  TComponent,
  TQueryParam extends string = string,
  TResult = unknown,
>(
  config: CreateOverlayHandlerWithQueryParamLifecycleConfig<TComponent>,
) => {
  const handler = createOverlayHandler<TComponent, void, TResult>({ ...config, closeOnNavigation: false });

  let fnCalled = false;
  let router: Router | null = null;

  const updateQueryParam = (value: TQueryParam | null) => {
    router?.navigate([], {
      queryParams: {
        [config.queryParamKey]: value,
      },
      queryParamsHandling: 'merge',
    });
  };

  const fn = (innerConfig?: CreateOverlayHandlerInnerConfig<TResult>) => {
    if (fnCalled) {
      throw new Error(
        'The function returned by createOverlayHandlerWithQueryParamLifecycle can only be called once until the caller is destroyed',
      );
    }

    fnCalled = true;

    router = inject(Router);
    const destroyRef = inject(DestroyRef);
    const injector = inject(Injector);
    const overlayHandler = handler({ ...(innerConfig ?? {}) });
    const queryParamValue = injectQueryParam<TQueryParam>(config.queryParamKey);

    let currentOverlayRef: OverlayRef<TComponent, TResult> | null = null;
    let inputSignalEffect: EffectRef | null = null;

    destroyRef.onDestroy(() => {
      fnCalled = false;
      router = null;
      cleanup();
    });

    const cleanup = () => {
      inputSignalEffect?.destroy();
      inputSignalEffect = null;
      updateQueryParam(null);
    };

    const getQueryParamInput = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (currentOverlayRef?.componentInstance as any)?.[OVERLAY_QUERY_PARAM_INPUT_NAME] as
        | ModelSignal<TQueryParam>
        | InputSignal<TQueryParam>
        | undefined;
    };

    effect(() => {
      const value = queryParamValue();

      untracked(() => {
        if (value) {
          if (!currentOverlayRef) {
            currentOverlayRef = overlayHandler.open();
            currentOverlayRef
              .beforeClosed()
              .pipe(
                takeUntilDestroyed(destroyRef),
                tap(() => cleanup()),
              )
              .subscribe();

            const inputSignal = getQueryParamInput();

            if (inputSignal) {
              inputSignalEffect = effect(
                () => {
                  const inputVal = inputSignal();

                  untracked(() => {
                    updateQueryParam(inputVal);
                  });
                },
                { injector },
              );
            }
          }

          if (getQueryParamInput()) {
            currentOverlayRef.componentRef?.setInput(OVERLAY_QUERY_PARAM_INPUT_NAME, value);
          }
        } else {
          if (currentOverlayRef) {
            inputSignalEffect?.destroy();
            inputSignalEffect = null;
            currentOverlayRef.close();
            currentOverlayRef = null;
          }
        }
      });
    });

    const open = (queryParamValue: TQueryParam) => updateQueryParam(queryParamValue);

    const close = () => {
      cleanup();
    };

    const lifecycleHandler: OverlayHandlerWithQueryParamLifecycle<TQueryParam> = {
      open,
      close,
    };

    return lifecycleHandler;
  };

  fn['injectOverlayRef'] = () => handler().injectOverlayRef();
  fn['updateQueryParam'] = (value: TQueryParam) => updateQueryParam(value);

  return fn;
};

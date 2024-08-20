import { ComponentType } from '@angular/cdk/overlay';
import { DestroyRef, effect, inject, TemplateRef, untracked, ViewContainerRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { injectQueryParam } from '@ethlete/core';
import { tap } from 'rxjs';
import { OverlayService } from '../services';
import { OverlayBreakpointConfigEntry, OverlayConfig, OverlayConsumerConfig } from '../types';
import { OverlayPositionBuilder } from './overlay-position-builder';
import { OverlayRef } from './overlay-ref';

export type CreateOverlayHandlerConfig<T, D = unknown, R = unknown> = Omit<OverlayConfig<D>, 'positions'> & {
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
  getOverlayRef: () => OverlayRef<T, R>;
};

export type CreateOverlayHandlerInnerConfig<R = unknown> = {
  /** A callback function to be executed once the overlay has been closed */
  afterClosed?: (result: R | null) => void;
};

export const createOverlayHandler = <TComponent, TOverlayData = unknown, TOverlayResult = unknown>(
  rootConfig: CreateOverlayHandlerConfig<TComponent, TOverlayData, TOverlayResult>,
) => {
  const fn = (innerConfig?: CreateOverlayHandlerInnerConfig<TOverlayResult>) => {
    const overlayService = inject(OverlayService);
    const viewContainerRef = inject(ViewContainerRef);
    const overlayRef = inject<OverlayRef<TComponent, TOverlayResult>>(OverlayRef, { optional: true });
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

      if (afterClosedFn) {
        ref
          .afterClosed()
          .pipe(
            takeUntilDestroyed(destroyRef),
            tap((r) => afterClosedFn(r ?? null)),
          )
          .subscribe();
      }

      return ref;
    };

    const getOverlayRef = () => {
      if (!overlayRef) {
        throw new Error('OverlayRef is only available inside the overlay component or templateRef');
      }

      return overlayRef;
    };

    const handler: OverlayHandler<TComponent, TOverlayData, TOverlayResult> = {
      open,
      getOverlayRef,
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
  'positions' | 'data'
> & {
  /** The overlay component  */
  component: ComponentType<T>;

  /** The overlay positions using the position builder provided via argument  */
  positions: (builder: OverlayPositionBuilder) => OverlayBreakpointConfigEntry[];

  /** The query param key to be used for the overlay  */
  queryParamKey: string;
};

const OVERLAY_QUERY_PARAM_INPUT_NAME = 'overlayQueryParam';

/**
 * This handler will automatically open the overlay when the query param is present.
 * The overlay can contain a required input with the name `overlayQueryParam` to receive the query param value.
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
  const handler = createOverlayHandler<TComponent, void, TResult>(config);

  let fnCalled = false;

  const fn = (innerConfig?: CreateOverlayHandlerInnerConfig<TResult>) => {
    if (fnCalled) {
      throw new Error(
        'The function returned by createOverlayHandlerWithQueryParamLifecycle can only be called once until the caller is destroyed',
      );
    }

    fnCalled = true;

    const router = inject(Router);
    const destroyRef = inject(DestroyRef);
    const overlayHandler = handler(innerConfig);
    const queryParamValue = injectQueryParam<TQueryParam>(config.queryParamKey);

    let currentOverlayRef: OverlayRef<TComponent, TResult> | null = null;

    destroyRef.onDestroy(() => {
      fnCalled = false;
      cleanup();
    });

    const cleanup = () => {
      router.navigate([], {
        queryParams: {
          [config.queryParamKey]: null,
        },
        queryParamsHandling: 'merge',
      });
    };

    effect(() => {
      const value = queryParamValue();

      untracked(() => {
        if (value) {
          if (!currentOverlayRef) {
            currentOverlayRef = overlayHandler.open();
            currentOverlayRef
              .afterClosed()
              .pipe(
                takeUntilDestroyed(destroyRef),
                tap(() => cleanup()),
              )
              .subscribe();
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((currentOverlayRef.componentInstance as any)[OVERLAY_QUERY_PARAM_INPUT_NAME]) {
            currentOverlayRef.componentRef?.setInput(OVERLAY_QUERY_PARAM_INPUT_NAME, value);
          }
        } else {
          if (currentOverlayRef) {
            currentOverlayRef.close();
            currentOverlayRef = null;
          }
        }
      });
    });

    const open = (queryParamValue: TQueryParam) => {
      router.navigate([], {
        queryParams: {
          [config.queryParamKey]: queryParamValue,
        },
        queryParamsHandling: 'merge',
      });
    };

    const close = () => {
      cleanup();
    };

    const lifecycleHandler: OverlayHandlerWithQueryParamLifecycle<TQueryParam> = {
      open,
      close,
    };

    return lifecycleHandler;
  };

  return fn;
};

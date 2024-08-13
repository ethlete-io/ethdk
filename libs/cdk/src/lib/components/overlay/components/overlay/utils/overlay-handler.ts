import { ComponentType } from '@angular/cdk/overlay';
import { DestroyRef, inject, TemplateRef, ViewContainerRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

export const createOverlayHandler = <T, D = unknown, R = unknown>(rootConfig: CreateOverlayHandlerConfig<T, D, R>) => {
  const fn = (innerConfig?: CreateOverlayHandlerInnerConfig<R>) => {
    const overlayService = inject(OverlayService);
    const viewContainerRef = inject(ViewContainerRef);
    const overlayRef = inject<OverlayRef<T, R>>(OverlayRef, { optional: true });
    const destroyRef = inject(DestroyRef);

    const tpl = rootConfig.component ?? rootConfig.template;

    if (!tpl) {
      throw new Error('Either component or template must be provided');
    }

    const open = (config?: OverlayConsumerConfig<D>) => {
      const ref = overlayService.open<T, D, R>(tpl, {
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

    const handler: OverlayHandler<T, D, R> = {
      open,
      getOverlayRef,
    };

    return handler;
  };

  return fn;
};

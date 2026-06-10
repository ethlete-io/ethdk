import { Type, computed } from '@angular/core';
import { OverlayRuntimeRef, createRootProvider, injectOverlayRuntime } from '@ethlete/core';
import { OverlayConfig } from './overlay-config';
import { OVERLAY_REF, OverlayRef, createOverlayRef } from './overlay-ref';

export type OverlayManager = {
  open: <TComponent extends object, TResult = unknown>(
    component: Type<TComponent>,
    config?: OverlayConfig,
  ) => OverlayRef<TComponent, TResult>;
  openOverlays: ReturnType<typeof computed<OverlayRef<object, unknown>[]>>;
};

let overlayId = 0;

const normalizeClassList = (value?: string | string[]) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

export const [provideOverlayManager, injectOverlayManager] = createRootProvider(
  (): OverlayManager => {
    const overlayRuntime = injectOverlayRuntime();
    const runtimeToOverlayRef = new WeakMap<OverlayRuntimeRef<object, unknown>, OverlayRef<object, unknown>>();

    const openOverlays = computed(() => {
      return overlayRuntime
        .openEntries()
        .map((runtimeRef) => runtimeToOverlayRef.get(runtimeRef))
        .filter((overlayRef): overlayRef is OverlayRef<object, unknown> => overlayRef !== undefined);
    });

    const open = <TComponent extends object, TResult = unknown>(
      component: Type<TComponent>,
      config: OverlayConfig = {},
    ) => {
      const id = config.id ?? `et-overlay-${++overlayId}`;
      const overlayRef = createOverlayRef<TComponent, TResult>(config);
      const modal = config.mode !== 'non-modal';
      const role = config.role ?? (modal ? 'dialog' : undefined);
      const disableClose = config.disableClose ?? false;
      const positionStrategy =
        config.positionStrategy ??
        (config.origin
          ? {
              kind: 'anchored' as const,
              referenceElement: config.origin,
            }
          : {
              kind: 'center' as const,
            });
      const runtimeRef = overlayRuntime.mount<TComponent, TResult>({
        id,
        component,
        viewContainerRef: config.viewContainerRef,
        injector: config.injector,
        providers: [{ provide: OVERLAY_REF, useValue: overlayRef }, ...(config.providers ?? [])],
        inputBindings: config.inputBindings,
        role,
        positionStrategy,
        hasBackdrop: config.hasBackdrop ?? modal,
        modal,
        autoFocus: config.autoFocus,
        restoreFocus: config.restoreFocus,
        closeOnEscape: disableClose ? false : (config.closeOnEscape ?? true),
        closeOnOutsidePointer: disableClose ? false : (config.closeOnOutsidePointer ?? true),
        ariaDescribedBy: config.ariaDescribedBy,
        ariaLabelledBy: config.ariaLabelledBy,
        ariaLabel: config.ariaLabel,
        hostClass: normalizeClassList(config.hostClass),
        backdropClass: normalizeClassList(config.backdropClass),
        paneClass: normalizeClassList(config.panelClass),
      });

      overlayRef.attachRuntime(runtimeRef);
      runtimeToOverlayRef.set(
        runtimeRef as OverlayRuntimeRef<object, unknown>,
        overlayRef as OverlayRef<object, unknown>,
      );

      return overlayRef;
    };

    return {
      open,
      openOverlays,
    };
  },
  { name: 'OverlayManager' },
);

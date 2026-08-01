import { DOCUMENT, EnvironmentInjector, Type, computed, inject, inputBinding } from '@angular/core';
import {
  anchoredOverlayPosition,
  defineRootProvider,
  injectOverlayRuntime,
  OverlayRuntimeRef,
  toInjectFn,
  toProvideFn,
} from '@ethlete/core';
import { OverlayConfig } from './overlay-config';
import { OverlayContainerComponent } from './overlay-container.component';
import { OVERLAY_REF, OverlayRef, createOverlayRef } from './overlay-ref';
import { createOverlayStrategyController } from './strategies/overlay-strategy-controller';

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

const isValidOriginElement = (element: Element | null): element is HTMLElement => {
  if (!element) return false;
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();
  return tagName !== 'html' && tagName !== 'body';
};

const resolveOrigin = (origin: HTMLElement | Event | undefined, document: Document) => {
  if (origin) return origin;

  const activeElement = document.activeElement;
  return isValidOriginElement(activeElement) ? activeElement : undefined;
};

const OVERLAY_MANAGER_DEF = /* @__PURE__ */ defineRootProvider(
  (): OverlayManager => {
    const overlayRuntime = injectOverlayRuntime();
    const injector = inject(EnvironmentInjector);
    const document = inject(DOCUMENT);
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
      if (config.strategies) {
        return openWithStrategies<TComponent, TResult>(component, config);
      }

      const id = config.id ?? `et-overlay-${++overlayId}`;
      const overlayRef = createOverlayRef<TComponent, TResult>(config);
      const modal = config.mode !== 'non-modal';
      const role = config.role ?? (modal ? 'dialog' : undefined);
      const disableClose = config.disableClose ?? false;
      const positionStrategy =
        config.origin instanceof HTMLElement
          ? anchoredOverlayPosition({ referenceElement: config.origin })
          : {
              kind: 'center' as const,
            };
      const runtimeRef = overlayRuntime.mount<TComponent, TResult>({
        id,
        component,
        viewContainerRef: config.viewContainerRef,
        injector: config.injector,
        providers: [{ provide: OVERLAY_REF, useValue: overlayRef }, ...(config.providers ?? [])],
        bindings: config.bindings,
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

    const openWithStrategies = <TComponent extends object, TResult = unknown>(
      component: Type<TComponent>,
      config: OverlayConfig,
    ) => {
      const id = config.id ?? `et-overlay-${++overlayId}`;
      const resolvedConfig: OverlayConfig = {
        ...config,
        id,
        origin: resolveOrigin(config.origin, document),
      };

      const overlayRef = createOverlayRef<TComponent, TResult>(resolvedConfig);
      const controller = createOverlayStrategyController(resolvedConfig, injector);
      const modal = resolvedConfig.mode !== 'non-modal';
      const role = resolvedConfig.role ?? (modal ? 'dialog' : undefined);
      const disableClose = resolvedConfig.disableClose ?? false;

      const runtimeRef = overlayRuntime.mount<OverlayContainerComponent, TResult>({
        id,
        component: OverlayContainerComponent,
        viewContainerRef: resolvedConfig.viewContainerRef,
        injector: resolvedConfig.injector,
        providers: [{ provide: OVERLAY_REF, useValue: overlayRef }, ...(resolvedConfig.providers ?? [])],
        bindings: [
          inputBinding('component', () => component),
          inputBinding('componentBindings', () => resolvedConfig.bindings),
          inputBinding('renderArrow', () => controller.initialMountConfig.renderArrow),
        ],
        role,
        positionStrategy: controller.initialMountConfig.positionStrategy,
        animationDelegate: controller.initialMountConfig.animationDelegate,
        hasBackdrop: resolvedConfig.hasBackdrop ?? controller.initialMountConfig.hasBackdrop ?? modal,
        modal,
        autoFocus: resolvedConfig.autoFocus,
        restoreFocus: resolvedConfig.restoreFocus,
        closeOnEscape: disableClose ? false : (resolvedConfig.closeOnEscape ?? true),
        closeOnOutsidePointer: disableClose ? false : (resolvedConfig.closeOnOutsidePointer ?? true),
        ariaDescribedBy: resolvedConfig.ariaDescribedBy,
        ariaLabelledBy: resolvedConfig.ariaLabelledBy,
        ariaLabel: resolvedConfig.ariaLabel,
        hostClass: [...normalizeClassList(resolvedConfig.hostClass), ...controller.initialMountConfig.hostClass],
        backdropClass: [
          ...normalizeClassList(resolvedConfig.backdropClass),
          ...controller.initialMountConfig.backdropClass,
        ],
        paneClass: [...normalizeClassList(resolvedConfig.panelClass), ...controller.initialMountConfig.paneClass],
      });

      const typedRuntimeRef = runtimeRef as unknown as OverlayRuntimeRef<TComponent, TResult>;

      overlayRef.attachRuntime(typedRuntimeRef);
      overlayRef.attachComponentInstanceOverride(
        () => (runtimeRef.componentInstance()?.contentComponentRef()?.instance as TComponent | null) ?? null,
      );
      controller.attach(runtimeRef as OverlayRuntimeRef<object, unknown>, overlayRef as OverlayRef<object, unknown>);

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

export const provideOverlayManager = /* @__PURE__ */ toProvideFn(OVERLAY_MANAGER_DEF);
export const injectOverlayManager = /* @__PURE__ */ toInjectFn(OVERLAY_MANAGER_DEF);

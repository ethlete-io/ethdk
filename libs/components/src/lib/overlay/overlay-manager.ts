import { DOCUMENT, EnvironmentInjector, Type, computed, inject, inputBinding } from '@angular/core';
import {
  anchoredOverlayPosition,
  defineRootProvider,
  injectOverlayRuntime,
  OverlayRuntimeRef,
  resolveOverlayLayer,
  toInjectFn,
  toProvideFn,
} from '@ethlete/core';
import { normalizeClassList } from './normalize-class-list';
import { OverlayConfig } from './overlay-config';
import { OverlayContainerComponent } from './overlay-container.component';
import { OVERLAY_HAS_BACKDROP, resolveOverlayHasBackdrop } from './overlay-has-backdrop';
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

/**
 * The document an overlay mounts into: its origin's, so an overlay opened from an element living in
 * another same-origin window (e.g. a panel adopted by a pop-up) opens in that window.
 */
const resolveOriginDocument = (origin: HTMLElement | Event | undefined, fallback: Document) => {
  if (origin instanceof HTMLElement) return origin.ownerDocument;
  if (origin && origin.target instanceof Node) return origin.target.ownerDocument ?? fallback;

  return fallback;
};

/**
 * The stacking level an overlay opened from `origin` mounts at: whatever the nearest ancestor
 * declaring `data-et-overlay-layer` says, so an overlay opened from inside an always-on-top surface
 * (the query devtools panel, say) is not painted behind it.
 */
const resolveZIndex = (origin: HTMLElement | Event | undefined, document: Document) => {
  const resolved = resolveOrigin(origin, document);

  if (resolved instanceof HTMLElement) {
    return resolveOverlayLayer(resolved);
  }

  return resolveOverlayLayer(resolved?.target instanceof Element ? resolved.target : null);
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
        document: resolveOriginDocument(config.origin, document),
        zIndex: config.zIndex ?? resolveZIndex(config.origin, document),
        viewContainerRef: config.viewContainerRef,
        injector: config.injector,
        providers: [{ provide: OVERLAY_REF, useValue: overlayRef }, ...(config.providers ?? [])],
        bindings: config.bindings,
        role,
        positionStrategy,
        hasBackdrop: resolveOverlayHasBackdrop(config),
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
        document: resolveOriginDocument(resolvedConfig.origin, document),
        zIndex: resolvedConfig.zIndex ?? resolveZIndex(resolvedConfig.origin, document),
        viewContainerRef: resolvedConfig.viewContainerRef,
        injector: resolvedConfig.injector,
        providers: [
          { provide: OVERLAY_REF, useValue: overlayRef },
          { provide: OVERLAY_HAS_BACKDROP, useValue: controller.initialMountConfig.hasBackdrop },
          ...(resolvedConfig.providers ?? []),
        ],
        bindings: [
          inputBinding('component', () => component),
          inputBinding('componentBindings', () => resolvedConfig.bindings),
          inputBinding('renderArrow', () => controller.initialMountConfig.renderArrow),
          inputBinding('renderDragHandle', () => controller.initialMountConfig.renderDragHandle),
        ],
        role,
        positionStrategy: controller.initialMountConfig.positionStrategy,
        animationDelegate: controller.initialMountConfig.animationDelegate,
        hasBackdrop: controller.initialMountConfig.hasBackdrop,
        modal,
        autoFocus: resolvedConfig.autoFocus,
        restoreFocus: resolvedConfig.restoreFocus,
        closeOnEscape: disableClose ? false : (resolvedConfig.closeOnEscape ?? true),
        closeOnOutsidePointer: disableClose ? false : (resolvedConfig.closeOnOutsidePointer ?? true),
        ariaDescribedBy: resolvedConfig.ariaDescribedBy,
        ariaLabelledBy: resolvedConfig.ariaLabelledBy,
        ariaLabel: resolvedConfig.ariaLabel,
        hostClass: [...normalizeClassList(resolvedConfig.hostClass), ...controller.initialMountConfig.hostClass],
        // the strategy's own backdrop classes are applied by the controller - the backdrop element is
        // re-created when a switch turns it back on, and only the config's classes survive that
        backdropClass: normalizeClassList(resolvedConfig.backdropClass),
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

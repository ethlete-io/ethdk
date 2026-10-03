import {
  DOCUMENT,
  DestroyRef,
  EnvironmentInjector,
  Type,
  computed,
  inject,
  inputBinding,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, ROUTES, Router } from '@angular/router';
import {
  anchoredOverlayPosition,
  defineRootProvider,
  injectOverlayRuntime,
  isElement,
  OverlayRuntimeRef,
  resolveOverlayLayer,
  RuntimeError,
  toInjectFn,
  toProvideFn,
} from '@ethlete/core';
import { filter, tap } from 'rxjs';
import { normalizeClassList } from './normalize-class-list';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { warnIfOverlayScrollBlockerMissing } from './overlay-scroll-blocker-registry';
import { OverlayConfig } from './overlay-config';
import { OverlayContainerComponent } from './overlay-container.component';
import { OVERLAY_HAS_BACKDROP, resolveOverlayHasBackdrop } from './overlay-has-backdrop';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';
import { createOverlayRef, getOverlayRefInternals } from './overlay-ref-internal';
import { createOverlayStrategyController } from './strategies/overlay-strategy-controller';
import { resolveOriginElement } from './strategies/resolve-origin-element';

export type OverlayManager = {
  open: <TComponent extends object, TResult = unknown>(
    component: Type<TComponent>,
    config?: OverlayConfig,
  ) => OverlayRef<TComponent, TResult>;
  openOverlays: ReturnType<typeof computed<OverlayRef<object, unknown>[]>>;
};

let overlayId = 0;

const isValidOriginElement = (element: Element | null): element is Element => {
  if (!isElement(element)) return false;

  const tagName = element.tagName.toLowerCase();
  return tagName !== 'html' && tagName !== 'body';
};

const resolveOrigin = (origin: Element | Event | null | undefined, document: Document) => {
  if (origin !== undefined) return origin ?? undefined;

  const activeElement = document.activeElement;
  return isValidOriginElement(activeElement) ? activeElement : undefined;
};

const resolveOriginDocument = (origin: Element | Event | null | undefined, fallback: Document) => {
  if (isElement(origin)) return origin.ownerDocument;
  if (origin && origin.target instanceof Node) return origin.target.ownerDocument ?? fallback;

  return fallback;
};

const resolveZIndex = (origin: Element | Event | null | undefined, document: Document) => {
  const resolved = resolveOrigin(origin, document);

  if (isElement(resolved)) {
    return resolveOverlayLayer(resolved);
  }

  return resolveOverlayLayer(resolved?.target instanceof Element ? resolved.target : null);
};

const stripQueryAndFragment = (url: string) => url.split(/[?#]/, 1)[0];

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

    const router = inject(ROUTES, { optional: true }) ? inject(Router) : null;

    router?.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        filter((event) => stripQueryAndFragment(event.url) !== stripQueryAndFragment(router.url)),
        tap(() => {
          for (const overlayRef of untracked(openOverlays)) {
            if (!(overlayRef.config.closeOnNavigation ?? !overlayRef.config.disableClose)) continue;

            getOverlayRefInternals(overlayRef)?.closeVia('navigation');
          }
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe();

    const open = <TComponent extends object, TResult = unknown>(
      component: Type<TComponent>,
      config: OverlayConfig = {},
    ) => {
      if (ngDevMode && config.mode !== 'non-modal' && !config.passive) {
        warnIfOverlayScrollBlockerMissing(document);
      }

      if (config.strategies) {
        return openWithStrategies<TComponent, TResult>(component, config);
      }

      if (ngDevMode && (config.directives?.length || config.customAnimated)) {
        throw new RuntimeError(
          OVERLAY_ERROR_CODES.STRATEGY_ONLY_OPTION,
          `[Overlay] \`${config.directives?.length ? 'directives' : 'customAnimated'}\` only applies to an overlay opened with \`strategies\`. Add a strategy (e.g. \`strategies: () => [{ strategy: dialogOverlayStrategy() }]\`) or remove the option.`,
        );
      }

      const id = config.id ?? `et-overlay-${++overlayId}`;
      const { ref: overlayRef, internals } = createOverlayRef<TComponent, TResult>(config);
      const modal = config.mode !== 'non-modal';
      const role = config.role ?? (modal ? 'dialog' : undefined);
      const disableClose = config.disableClose ?? false;
      const originElement = resolveOriginElement(config.origin);
      const positionStrategy = originElement
        ? anchoredOverlayPosition({ referenceElement: originElement })
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
        passive: config.passive,
        ariaDescribedBy: config.ariaDescribedBy,
        ariaLabelledBy: config.ariaLabelledBy,
        ariaLabel: config.ariaLabel,
        hostClass: normalizeClassList(config.hostClass),
        backdropClass: normalizeClassList(config.backdropClass),
        paneClass: normalizeClassList(config.panelClass),
      });

      internals.attachRuntime(runtimeRef);
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

      const { ref: overlayRef, internals } = createOverlayRef<TComponent, TResult>(resolvedConfig);
      const controller = createOverlayStrategyController(resolvedConfig, injector);
      const modal = resolvedConfig.mode !== 'non-modal';
      const role = resolvedConfig.role ?? (modal ? 'dialog' : undefined);
      const disableClose = resolvedConfig.disableClose ?? false;

      let runtimeRef: OverlayRuntimeRef<OverlayContainerComponent, TResult>;

      try {
        runtimeRef = overlayRuntime.mount<OverlayContainerComponent, TResult>({
          id,
          component: OverlayContainerComponent,
          document: resolveOriginDocument(resolvedConfig.origin, document),
          zIndex: resolvedConfig.zIndex ?? resolveZIndex(resolvedConfig.origin, document),
          viewContainerRef: resolvedConfig.viewContainerRef,
          injector: resolvedConfig.injector,
          providers: [
            { provide: OVERLAY_REF, useValue: overlayRef },
            { provide: OVERLAY_HAS_BACKDROP, useValue: controller.hasBackdrop },
            ...(resolvedConfig.providers ?? []),
          ],
          bindings: [
            inputBinding('component', () => component),
            inputBinding('componentBindings', () => resolvedConfig.bindings),
            inputBinding('componentDirectives', () => resolvedConfig.directives),
            inputBinding('renderArrow', () => controller.renderArrow()),
            inputBinding('renderDragHandle', () => controller.renderDragHandle()),
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
          passive: resolvedConfig.passive,
          ariaDescribedBy: resolvedConfig.ariaDescribedBy,
          ariaLabelledBy: resolvedConfig.ariaLabelledBy,
          ariaLabel: resolvedConfig.ariaLabel,
          hostClass: [...normalizeClassList(resolvedConfig.hostClass), ...controller.initialMountConfig.hostClass],
          // the strategy's own backdrop classes are applied by the controller - the backdrop element is
          // re-created when a switch turns it back on, and only the config's classes survive that
          backdropClass: normalizeClassList(resolvedConfig.backdropClass),
          paneClass: [...normalizeClassList(resolvedConfig.panelClass), ...controller.initialMountConfig.paneClass],
        });
      } catch (error) {
        controller.destroy();

        throw error;
      }

      const typedRuntimeRef = runtimeRef as unknown as OverlayRuntimeRef<TComponent, TResult>;

      internals.attachRuntime(typedRuntimeRef);
      internals.attachComponentInstanceOverride(
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

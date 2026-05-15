import {
  ApplicationRef,
  DOCUMENT,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  computed,
  createComponent,
  inject,
  signal,
} from '@angular/core';
import { arrow, autoUpdate, computePosition, flip, hide, limitShift, offset, shift, size } from '@floating-ui/dom';
import { filter, take } from 'rxjs';
import { ANIMATED_LIFECYCLE_TOKEN, nextFrame } from '../animations';
import { injectRenderer } from '../providers';
import { createRootProvider } from '../utils';
import { OverlayRuntimeRef } from './overlay-runtime-ref';
import {
  OverlayRuntimeAnchoredPosition,
  OverlayRuntimeAutoFocusTarget,
  OverlayRuntimeCenteredPosition,
  OverlayRuntimeCloseEvent,
  OverlayRuntimeComponentBase,
  OverlayRuntimeMountConfig,
} from './overlay-runtime.types';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

type OverlayRuntime = {
  mount: <TComponent extends object, TResult = unknown>(
    config: OverlayRuntimeMountConfig<TComponent>,
  ) => OverlayRuntimeRef<TComponent, TResult>;
  openEntries: ReturnType<typeof computed<OverlayRuntimeRef<object, unknown>[]>>;
};

export const [provideOverlayRuntime, injectOverlayRuntime] = createRootProvider(
  (): OverlayRuntime => {
    const appRef = inject(ApplicationRef);
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const environmentInjector = inject(EnvironmentInjector);
    const renderer = injectRenderer();

    const openEntriesState = signal<OverlayRuntimeRef<object, unknown>[]>([]);
    const openEntries = computed(() => openEntriesState());

    let rootElement: HTMLElement | null = null;

    const getRootElement = () => {
      if (rootElement) {
        return rootElement;
      }

      rootElement = renderer.createElement('div');
      renderer.addClass(rootElement, 'et-overlay-runtime-root');
      renderer.setStyle(rootElement, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        pointerEvents: 'none',
        zIndex: '1000',
      });
      renderer.appendChild(document.body, rootElement);

      return rootElement;
    };

    const maybeDestroyRootElement = () => {
      if (!rootElement || openEntriesState().length > 0) {
        return;
      }

      const parentNode = renderer.parentNode(rootElement);
      if (parentNode) {
        renderer.removeChild(parentNode, rootElement);
      }

      rootElement = null;
    };

    const isTopMost = (overlayRef: OverlayRuntimeRef<object, unknown>) => {
      return openEntriesState().at(-1) === overlayRef;
    };

    const normalizeAutoFocus = (value: OverlayRuntimeAutoFocusTarget | string | false | undefined) => {
      return value ?? 'first-tabbable';
    };

    const isHTMLElement = (value: unknown): value is HTMLElement => {
      return value instanceof HTMLElement;
    };

    const isFocusable = (element: HTMLElement) => {
      const view = document.defaultView;
      const style = view?.getComputedStyle(element);
      const isVisible =
        style?.display !== 'none' && style?.visibility !== 'hidden' && element.getClientRects().length > 0;

      return isVisible && !element.hasAttribute('disabled') && element.tabIndex >= 0;
    };

    const getFocusableElements = (container: HTMLElement) => {
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
    };

    const getHeadingElement = (container: HTMLElement) => {
      return container.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]');
    };

    const focusElement = (element: HTMLElement | null) => {
      if (!element) {
        return;
      }

      element.focus({ preventScroll: true });
    };

    const setBaseElementStyles = (
      config: OverlayRuntimeMountConfig<object>,
      hostElement: HTMLElement,
      paneElement: HTMLElement,
    ) => {
      renderer.setStyle(hostElement, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        display: 'block',
        pointerEvents: config.hasBackdrop === false ? 'none' : 'auto',
      });

      renderer.setStyle(paneElement, {
        pointerEvents: 'auto',
        outline: 'none',
      });
    };

    const setBackdropStyles = (backdropElement: HTMLElement) => {
      renderer.setStyle(backdropElement, {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
      });
    };

    const applyCenteredPosition = (
      hostElement: HTMLElement,
      paneElement: HTMLElement,
      config: OverlayRuntimeCenteredPosition,
    ) => {
      void config;

      renderer.setStyle(hostElement, {
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        overflow: 'auto',
      });

      renderer.setStyle(paneElement, {
        position: 'relative',
      });
    };

    const createAnchoredPositionCleanup = (
      strategy: OverlayRuntimeAnchoredPosition,
      paneElement: HTMLElement,
      overlayRef: OverlayRuntimeRef<object, unknown>,
    ) => {
      const arrowElement = paneElement.querySelector<HTMLElement>('[et-floating-arrow]');

      renderer.setStyle(paneElement, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: strategy.mirrorWidth ? `${strategy.referenceElement.offsetWidth}px` : 'max-content',
      });

      const cleanup = autoUpdate(strategy.referenceElement, paneElement, () => {
        const middleware = [];

        middleware.push(offset(strategy.offset ?? 8));
        middleware.push(
          flip({
            fallbackPlacements: strategy.fallbackPlacements ?? undefined,
            fallbackAxisSideDirection: 'start',
          }),
        );

        if (strategy.autoResize) {
          middleware.push(
            size({
              padding: strategy.viewportPadding ?? 8,
              apply({ availableHeight, availableWidth }) {
                renderer.setCssProperties(paneElement, {
                  '--et-overlay-max-width': `${availableWidth}px`,
                  '--et-overlay-max-height': `${availableHeight}px`,
                });
              },
            }),
          );
        }

        if (strategy.shift !== false) {
          middleware.push(
            shift({
              limiter: limitShift(),
              padding: strategy.viewportPadding ?? 8,
            }),
          );
        }

        if (arrowElement) {
          middleware.push(
            arrow({
              element: arrowElement,
              padding: strategy.arrowPadding ?? 4,
            }),
          );
        }

        if (strategy.autoHide || strategy.autoCloseIfReferenceHidden) {
          middleware.push(
            hide({
              strategy: 'referenceHidden',
            }),
          );
        }

        computePosition(strategy.referenceElement, paneElement, {
          placement: strategy.placement ?? 'bottom',
          strategy: 'absolute',
          middleware,
        }).then(({ x, y, placement, middlewareData }) => {
          renderer.setStyle(paneElement, {
            transform: `translate3d(${x}px, ${y}px, 0)`,
            width: strategy.mirrorWidth ? `${strategy.referenceElement.offsetWidth}px` : null,
          });
          renderer.setAttribute(paneElement, 'data-overlay-placement', placement);

          if (arrowElement && middlewareData.arrow) {
            renderer.setCssProperty(
              arrowElement,
              '--et-floating-arrow-translate',
              `translate3d(${middlewareData.arrow.x ?? 0}px, ${middlewareData.arrow.y ?? 0}px, 0)`,
            );
          }

          if (middlewareData.hide?.referenceHidden) {
            if (strategy.autoCloseIfReferenceHidden) {
              overlayRef.close(undefined, 'api');
              return;
            }

            renderer.setStyle(paneElement, {
              visibility: strategy.autoHide ? 'hidden' : null,
            });
            return;
          }

          renderer.setStyle(paneElement, {
            visibility: null,
          });
        });
      });

      return () => {
        cleanup();
      };
    };

    const setupPositioning = (
      config: OverlayRuntimeMountConfig<object>,
      hostElement: HTMLElement,
      paneElement: HTMLElement,
      overlayRef: OverlayRuntimeRef<object, unknown>,
    ) => {
      const strategy = config.positionStrategy ?? { kind: 'center' };

      if (strategy.kind === 'anchored') {
        renderer.setStyle(hostElement, {
          pointerEvents: config.hasBackdrop === false ? 'none' : 'auto',
        });

        return createAnchoredPositionCleanup(strategy, paneElement, overlayRef);
      }

      applyCenteredPosition(hostElement, paneElement, strategy);

      return () => undefined;
    };

    const applyInitialFocus = (paneElement: HTMLElement, autoFocus: OverlayRuntimeAutoFocusTarget | string | false) => {
      if (autoFocus === false) {
        return;
      }

      if (autoFocus === 'container') {
        focusElement(paneElement);
        return;
      }

      if (autoFocus === 'first-heading') {
        focusElement(getHeadingElement(paneElement) ?? paneElement);
        return;
      }

      if (autoFocus === 'first-tabbable') {
        focusElement(getFocusableElements(paneElement)[0] ?? paneElement);
        return;
      }

      focusElement(paneElement.querySelector<HTMLElement>(autoFocus) ?? paneElement);
    };

    const setupFocusTrap = (
      paneElement: HTMLElement,
      overlayRef: OverlayRuntimeRef<object, unknown>,
      enabled: boolean,
    ) => {
      if (!enabled) {
        return () => undefined;
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Tab' || !isTopMost(overlayRef)) {
          return;
        }

        const focusableElements = getFocusableElements(paneElement);
        if (focusableElements.length === 0) {
          event.preventDefault();
          focusElement(paneElement);
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          focusElement(lastElement ?? null);
          return;
        }

        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          focusElement(firstElement ?? null);
        }
      };

      paneElement.addEventListener('keydown', onKeyDown);

      return () => {
        paneElement.removeEventListener('keydown', onKeyDown);
      };
    };

    const getAnimatedLifecycle = (componentRef: ReturnType<typeof createComponent>) => {
      const componentLifecycle = (componentRef.instance as OverlayRuntimeComponentBase).animatedLifecycle?.();

      if (componentLifecycle) {
        return componentLifecycle;
      }

      return componentRef.injector.get(ANIMATED_LIFECYCLE_TOKEN, null);
    };

    const mount = <TComponent extends object, TResult = unknown>(config: OverlayRuntimeMountConfig<TComponent>) => {
      const root = getRootElement();
      const hostElement = renderer.createElement('div');
      const paneElement = renderer.createElement('div');
      const backdropElement = config.hasBackdrop === false ? null : renderer.createElement('div');
      const previousFocusedElement = isHTMLElement(document.activeElement) ? document.activeElement : null;
      const autoFocus = normalizeAutoFocus(config.autoFocus);

      renderer.addClass(hostElement, 'et-overlay-runtime-entry');
      renderer.addClass(paneElement, 'et-overlay-runtime-pane');
      setBaseElementStyles(config as OverlayRuntimeMountConfig<object>, hostElement, paneElement);
      renderer.setAttribute(hostElement, 'data-overlay-id', config.id);
      renderer.setAttribute(paneElement, 'data-overlay-id', config.id);
      renderer.setAttribute(paneElement, 'role', config.role ?? null);
      renderer.setAttribute(paneElement, 'tabindex', '-1');
      renderer.setAttribute(paneElement, 'aria-modal', config.role ? `${config.modal !== false}` : null);
      renderer.setAttribute(paneElement, 'aria-describedby', config.ariaDescribedBy ?? null);
      renderer.setAttribute(paneElement, 'aria-labelledby', config.ariaLabelledBy ?? null);
      renderer.setAttribute(paneElement, 'aria-label', config.ariaLabel ?? null);

      (config.hostClass ?? []).forEach((className) => renderer.addClass(hostElement, className));
      (config.paneClass ?? []).forEach((className) => renderer.addClass(paneElement, className));

      if (backdropElement) {
        renderer.addClass(backdropElement, 'et-overlay-runtime-backdrop');
        setBackdropStyles(backdropElement);
        renderer.setAttribute(backdropElement, 'data-overlay-id', config.id);
        (config.backdropClass ?? []).forEach((className) => renderer.addClass(backdropElement, className));
        renderer.appendChild(hostElement, backdropElement);
      }

      renderer.appendChild(hostElement, paneElement);
      renderer.appendChild(root, hostElement);

      const overlayRef = new OverlayRuntimeRef<TComponent, TResult>(
        config.id,
        {
          ...config,
        },
        {
          rootElement: root,
          hostElement,
          backdropElement,
          paneElement,
        },
        (result, source) => beginClose({ result, source }),
      );

      const cleanupFns: Array<() => void> = [];
      const parentInjector = config.injector ?? config.viewContainerRef?.injector ?? environmentInjector;
      const elementInjector = Injector.create({
        parent: parentInjector,
        providers: config.providers ?? [],
      });

      const componentRef = createComponent(config.component, {
        environmentInjector,
        elementInjector,
        hostElement: paneElement,
      });

      appRef.attachView(componentRef.hostView);
      overlayRef.attachComponentRef(componentRef);
      overlayRef.beforeOpenedSubject.next();
      overlayRef.beforeOpenedSubject.complete();

      openEntriesState.update((entries) => [...entries, overlayRef as OverlayRuntimeRef<object, unknown>]);

      cleanupFns.push(
        setupPositioning(
          config as OverlayRuntimeMountConfig<object>,
          hostElement,
          paneElement,
          overlayRef as OverlayRuntimeRef<object, unknown>,
        ),
      );

      const destroyMountedOverlay = (closeEvent: OverlayRuntimeCloseEvent<TResult>) => {
        cleanupFns.forEach((cleanup) => cleanup());
        appRef.detachView(componentRef.hostView);
        componentRef.destroy();

        const parentNode = renderer.parentNode(hostElement);
        if (parentNode) {
          renderer.removeChild(parentNode, hostElement);
        }

        openEntriesState.update((entries) => entries.filter((entry) => entry !== overlayRef));
        maybeDestroyRootElement();

        if (config.restoreFocus !== false && previousFocusedElement?.isConnected) {
          focusElement(previousFocusedElement);
        }

        overlayRef.finishClose(closeEvent);
      };

      const beginClose = (closeEvent: OverlayRuntimeCloseEvent<TResult>) => {
        if (!overlayRef.beginClose(closeEvent)) {
          return;
        }

        const lifecycle = getAnimatedLifecycle(componentRef);
        if (!lifecycle) {
          destroyMountedOverlay(closeEvent);
          return;
        }

        lifecycle.leave();
        lifecycle.state$
          .pipe(
            filter((state) => state === 'left'),
            take(1),
          )
          .subscribe(() => {
            destroyMountedOverlay(closeEvent);
          });
      };

      const closeOnEscape = config.closeOnEscape ?? true;
      if (closeOnEscape) {
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key !== 'Escape' || !isTopMost(overlayRef as OverlayRuntimeRef<object, unknown>)) {
            return;
          }

          event.preventDefault();
          overlayRef.close(undefined, 'escape');
        };

        document.addEventListener('keydown', onKeyDown, true);
        cleanupFns.push(() => document.removeEventListener('keydown', onKeyDown, true));
      }

      const closeOnOutsidePointer = config.closeOnOutsidePointer ?? config.modal === false;
      if (closeOnOutsidePointer) {
        const onPointerDown = (event: PointerEvent) => {
          if (!isTopMost(overlayRef as OverlayRuntimeRef<object, unknown>)) {
            return;
          }

          const target = event.target;
          if (!isHTMLElement(target) || paneElement.contains(target)) {
            return;
          }

          overlayRef.close(undefined, 'outside-pointer');
        };

        document.addEventListener('pointerdown', onPointerDown, true);
        cleanupFns.push(() => document.removeEventListener('pointerdown', onPointerDown, true));
      }

      cleanupFns.push(
        setupFocusTrap(paneElement, overlayRef as OverlayRuntimeRef<object, unknown>, config.modal !== false),
      );

      nextFrame(() => {
        if (overlayRef.state() !== 'mounting') {
          return;
        }

        const lifecycle = getAnimatedLifecycle(componentRef);
        if (!lifecycle) {
          applyInitialFocus(paneElement, autoFocus);
          overlayRef.markOpened();
          return;
        }

        lifecycle.enter();
        lifecycle.state$
          .pipe(
            filter((state) => state === 'entered'),
            take(1),
          )
          .subscribe(() => {
            applyInitialFocus(paneElement, autoFocus);
            overlayRef.markOpened();
          });
      });

      return overlayRef;
    };

    destroyRef.onDestroy(() => {
      openEntriesState().forEach((entry) => entry.close(undefined, 'api'));
      maybeDestroyRootElement();
    });

    return {
      mount,
      openEntries,
    };
  },
  { name: 'OverlayRuntime' },
);

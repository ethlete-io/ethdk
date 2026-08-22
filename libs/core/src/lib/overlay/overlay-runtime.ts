import {
  ApplicationRef,
  DOCUMENT,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  Signal,
  createEnvironmentInjector,
  createComponent,
  inject,
  signal,
} from '@angular/core';
import { filter, take } from 'rxjs';
import { ANIMATED_LIFECYCLE_TOKEN, animationDebugLog, nextFrame } from '../animations';
import { injectRenderer } from '../providers';
import { defineRootProvider, toInjectFn, toProvideFn } from '../utils';
import { applyInitialFocus, isHTMLElement, setupFocusTrap } from './overlay-focus';
import { DEFAULT_OVERLAY_LAYER, OVERLAY_LAYER_ATTRIBUTE, isOnHigherOverlayLayer } from './overlay-layer';
import { resetPositioningStyles, setBackdropStyles, setBaseElementStyles, setupPositioning } from './overlay-position';
import { OverlayRuntimeRef, createOverlayRuntimeRef } from './overlay-runtime-ref';
import {
  OverlayRuntimeCloseEvent,
  OverlayRuntimeComponentBase,
  OverlayRuntimeMountConfig,
} from './overlay-runtime.types';

type OverlayRuntime = {
  mount: <TComponent extends object, TResult = unknown>(
    config: OverlayRuntimeMountConfig<TComponent>,
  ) => OverlayRuntimeRef<TComponent, TResult>;
  openEntries: Signal<OverlayRuntimeRef<object, unknown>[]>;
};

const OVERLAY_RUNTIME_DEF = /* @__PURE__ */ defineRootProvider(
  (): OverlayRuntime => {
    const appRef = inject(ApplicationRef);
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const environmentInjector = inject(EnvironmentInjector);
    const renderer = injectRenderer();

    const openEntriesState = signal<OverlayRuntimeRef<object, unknown>[]>([]);
    const openEntries = openEntriesState.asReadonly();

    // One runtime root per document and stacking level: overlays usually all mount into the app's
    // document at the default level, but an overlay anchored inside a same-origin pop-up window
    // (config.document) needs a root over there, and one opened from inside something that paints
    // above the default level (config.zIndex) needs a root of its own to stack above it.
    const rootElements = new Map<Document, Map<number, HTMLElement>>();

    // Synchronous teardown for each currently-mounted overlay, run when the runtime's injector is
    // destroyed (app teardown). Registered on mount, removed once the overlay is destroyed normally.
    const mountedTeardowns = new Set<() => void>();

    const getRootElement = (targetDocument: Document, zIndex: number) => {
      let documentRoots = rootElements.get(targetDocument);

      if (!documentRoots) {
        documentRoots = new Map<number, HTMLElement>();
        rootElements.set(targetDocument, documentRoots);
      }

      const existingRoot = documentRoots.get(zIndex);
      if (existingRoot) {
        return existingRoot;
      }

      const rootElement = renderer.createElement('div');
      renderer.addClass(rootElement, 'et-overlay-runtime-root');
      // So an overlay opened from inside this root's own content resolves back to the same level
      // instead of dropping to the default one.
      renderer.setAttribute(rootElement, OVERLAY_LAYER_ATTRIBUTE, `${zIndex}`);
      renderer.setStyle(rootElement, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        pointerEvents: 'none',
        zIndex: `${zIndex}`,
      });
      renderer.appendChild(targetDocument.body, rootElement);
      documentRoots.set(zIndex, rootElement);

      return rootElement;
    };

    const maybeDestroyRootElements = (targetDocument: Document) => {
      const documentRoots = rootElements.get(targetDocument);

      if (!documentRoots) {
        return;
      }

      documentRoots.forEach((rootElement, zIndex) => {
        if (openEntriesState().some((entry) => entry.elements.rootElement === rootElement)) {
          return;
        }

        const parentNode = renderer.parentNode(rootElement);
        if (parentNode) {
          renderer.removeChild(parentNode, rootElement);
        }

        documentRoots.delete(zIndex);
      });

      if (!documentRoots.size) {
        rootElements.delete(targetDocument);
      }
    };

    const isTopMost = (overlayRef: OverlayRuntimeRef<object, unknown>) => {
      const entries = openEntriesState();

      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index];

        if (entry && entry.state() !== 'closing' && entry.state() !== 'closed') return entry === overlayRef;
      }

      return false;
    };

    const getAnimatedLifecycle = (componentRef: ReturnType<typeof createComponent>) => {
      const componentLifecycle = (componentRef.instance as OverlayRuntimeComponentBase).animatedLifecycle?.();

      if (componentLifecycle) {
        return componentLifecycle;
      }

      return componentRef.injector.get(ANIMATED_LIFECYCLE_TOKEN, null);
    };

    const mount = <TComponent extends object, TResult = unknown>(config: OverlayRuntimeMountConfig<TComponent>) => {
      const targetDocument = config.document ?? document;
      const layer = config.zIndex ?? DEFAULT_OVERLAY_LAYER;
      const root = getRootElement(targetDocument, layer);
      const hostElement = renderer.createElement('div');
      const paneElement = renderer.createElement('div');
      const backdropElement = signal<HTMLElement | null>(null);
      const previousFocusedElement = isHTMLElement(targetDocument.activeElement) ? targetDocument.activeElement : null;
      const autoFocus = config.autoFocus ?? 'first-tabbable';
      let currentHasBackdrop = config.hasBackdrop !== false;
      let currentPositionStrategy = config.positionStrategy;

      const activeConfig = () =>
        ({
          ...config,
          positionStrategy: currentPositionStrategy,
          hasBackdrop: currentHasBackdrop,
        }) as OverlayRuntimeMountConfig<object>;

      const createBackdropElement = () => {
        const element = renderer.createElement('div');

        renderer.addClass(element, 'et-overlay-runtime-backdrop');
        setBackdropStyles(element, renderer);
        renderer.setAttribute(element, 'data-overlay-id', config.id);
        (config.backdropClass ?? []).forEach((className) => renderer.addClass(element, className));

        return element;
      };

      renderer.addClass(hostElement, 'et-overlay-runtime-entry');
      setBaseElementStyles(activeConfig(), hostElement, paneElement, renderer);
      renderer.setAttributes(hostElement, {
        'data-overlay-id': config.id,
        role: config.role ?? null,
        tabindex: '-1',
        'aria-modal': config.role ? `${config.modal !== false}` : null,
        'aria-describedby': config.ariaDescribedBy ?? null,
        'aria-labelledby': config.ariaLabelledBy ?? null,
        'aria-label': config.ariaLabel ?? null,
      });

      renderer.addClass(hostElement, ...(config.hostClass ?? []));

      if (currentHasBackdrop) {
        const element = createBackdropElement();

        renderer.appendChild(hostElement, element);
        backdropElement.set(element);
      }

      renderer.appendChild(hostElement, paneElement);
      renderer.appendChild(root, hostElement);

      const overlayRef = createOverlayRuntimeRef<TComponent, TResult>(
        config.id,
        { ...config },
        {
          rootElement: root,
          hostElement,
          backdropElement: backdropElement.asReadonly(),
          paneElement,
        },
        (result, source) => beginClose({ result, source }),
      );

      animationDebugLog(`runtime ${config.id}`, 'mount');

      // matches the previous overlay behavior: escape/outside-pointer closes are
      // ignored until the enter transition has started plus one frame
      let interactiveCloseReady = false;

      const cleanupFns: Array<() => void> = [];
      const parentInjector = config.injector ?? config.viewContainerRef?.injector ?? environmentInjector;
      const parentEnvironmentInjector = parentInjector.get(EnvironmentInjector, environmentInjector);
      const overlayEnvironmentInjector = createEnvironmentInjector(config.providers ?? [], parentEnvironmentInjector);
      const elementInjector = Injector.create({
        parent: parentInjector,
        // Element DI chains to the opener, so without this the opener's environment injector answers
        // `EnvironmentInjector` from inside the overlay - and a component created through a
        // ViewContainerRef down there (the container's own content component) never sees
        // `config.providers`.
        providers: [{ provide: EnvironmentInjector, useValue: overlayEnvironmentInjector }],
      }) as EnvironmentInjector;

      const componentRef = createComponent(config.component, {
        environmentInjector: overlayEnvironmentInjector,
        elementInjector,
        hostElement: paneElement,
        bindings: config.bindings ?? [],
      });

      // pane classes are applied after component creation - Angular replaces the host
      // element's class attribute with the component's static host class on creation
      renderer.addClass(paneElement, 'et-overlay-runtime-pane', ...(config.paneClass ?? []));

      appRef.attachView(componentRef.hostView);
      overlayRef.attachComponentRef(componentRef);
      overlayRef.beforeOpenedSubject.next();
      overlayRef.beforeOpenedSubject.complete();

      openEntriesState.update((entries) => [...entries, overlayRef as OverlayRuntimeRef<object, unknown>]);

      let positionCleanup = setupPositioning(
        activeConfig(),
        hostElement,
        paneElement,
        overlayRef as OverlayRuntimeRef<object, unknown>,
        renderer,
      );
      cleanupFns.push(() => positionCleanup());

      const getOriginElement = () =>
        currentPositionStrategy?.kind === 'anchored' && isHTMLElement(currentPositionStrategy.referenceElement)
          ? currentPositionStrategy.referenceElement
          : null;

      overlayRef.attachPositionUpdater((strategy) => {
        currentPositionStrategy = strategy;
        positionCleanup();
        resetPositioningStyles(activeConfig(), hostElement, paneElement, renderer);
        positionCleanup = setupPositioning(
          activeConfig(),
          hostElement,
          paneElement,
          overlayRef as OverlayRuntimeRef<object, unknown>,
          renderer,
        );
      });

      overlayRef.attachBackdropUpdater((hasBackdrop) => {
        if (hasBackdrop === currentHasBackdrop) {
          return;
        }

        currentHasBackdrop = hasBackdrop;

        if (hasBackdrop) {
          const element = createBackdropElement();

          renderer.insertBefore(hostElement, element, paneElement);
          backdropElement.set(element);
        } else {
          const element = backdropElement();

          if (element) {
            renderer.removeChild(hostElement, element);
            backdropElement.set(null);
          }
        }

        renderer.setStyle(hostElement, { pointerEvents: hasBackdrop ? 'auto' : 'none' });
      });

      const destroyMountedOverlay = (closeEvent: OverlayRuntimeCloseEvent<TResult>) => {
        animationDebugLog(`runtime ${config.id}`, `destroy (source "${closeEvent.source}")`);
        cleanupFns.forEach((cleanup) => cleanup());
        appRef.detachView(componentRef.hostView);
        componentRef.destroy();

        // Angular does not own this injector, so nothing else tears down what the overlay's own
        // providers registered on it - their `DestroyRef` hooks and effects would outlive the overlay.
        if (!elementInjector.destroyed) {
          elementInjector.destroy();
        }
        overlayEnvironmentInjector.destroy();

        const parentNode = renderer.parentNode(hostElement);
        if (parentNode) {
          renderer.removeChild(parentNode, hostElement);
        }

        openEntriesState.update((entries) => entries.filter((entry) => entry !== overlayRef));
        maybeDestroyRootElements(targetDocument);

        if (config.restoreFocus !== false && previousFocusedElement?.isConnected) {
          previousFocusedElement.focus({ preventScroll: true });
        }

        overlayRef.finishClose(closeEvent);
      };

      // Allows the runtime to synchronously destroy this overlay on app teardown, bypassing the
      // async leave animation (whose completion callback would never fire once the app is gone).
      const forceTeardown = () => {
        const closeEvent = { result: undefined, source: 'api' } as const;
        overlayRef.beginClose(closeEvent);
        destroyMountedOverlay(closeEvent);
      };
      mountedTeardowns.add(forceTeardown);
      cleanupFns.push(() => mountedTeardowns.delete(forceTeardown));

      const beginClose = (closeEvent: OverlayRuntimeCloseEvent<TResult>) => {
        if (!overlayRef.beginClose(closeEvent)) {
          return;
        }

        const lifecycle = getAnimatedLifecycle(componentRef);

        animationDebugLog(
          `runtime ${config.id}`,
          `close requested (source "${closeEvent.source}", lifecycle state "${lifecycle?.state$.value ?? 'none'}", delegate ${config.animationDelegate?.leave ? 'yes' : 'no'})`,
        );

        // The reference element is gone - there is nothing left to animate away from, so tear the
        // overlay down synchronously instead of playing a leave transition from a stale position.
        if (!lifecycle || closeEvent.source === 'reference-detached') {
          destroyMountedOverlay(closeEvent);

          return;
        }

        if (config.animationDelegate?.leave) {
          config.animationDelegate.leave({ lifecycle, elements: overlayRef.elements, closeEvent });
        } else {
          lifecycle.leave();
        }

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
          if (
            event.key !== 'Escape' ||
            event.defaultPrevented ||
            !isTopMost(overlayRef as OverlayRuntimeRef<object, unknown>)
          ) {
            return;
          }

          if (!interactiveCloseReady) {
            animationDebugLog(`runtime ${config.id}`, 'escape ignored (enter transition has not started yet)');

            return;
          }

          event.preventDefault();
          overlayRef.close(undefined, 'escape');
        };

        // bubble phase so content inside the overlay can preventDefault or stopPropagation an Escape first
        targetDocument.addEventListener('keydown', onKeyDown);
        cleanupFns.push(() => targetDocument.removeEventListener('keydown', onKeyDown));
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

          if (isOnHigherOverlayLayer(target, layer)) {
            return;
          }

          if (!interactiveCloseReady) {
            animationDebugLog(`runtime ${config.id}`, 'outside pointer ignored (enter transition has not started yet)');

            return;
          }

          overlayRef.close(undefined, 'outside-pointer');

          const originElement = getOriginElement();
          if (originElement && originElement.contains(target)) {
            const swallowReopenClick = (clickEvent: MouseEvent) => {
              if (isHTMLElement(clickEvent.target) && originElement.contains(clickEvent.target)) {
                clickEvent.stopImmediatePropagation();
                clickEvent.preventDefault();
              }
            };

            targetDocument.addEventListener('click', swallowReopenClick, { capture: true, once: true });
          }
        };

        targetDocument.addEventListener('pointerdown', onPointerDown, true);
        cleanupFns.push(() => targetDocument.removeEventListener('pointerdown', onPointerDown, true));
      }

      cleanupFns.push(
        setupFocusTrap(
          paneElement,
          overlayRef as OverlayRuntimeRef<object, unknown>,
          config.modal !== false,
          isTopMost,
          targetDocument,
        ),
      );

      nextFrame(() => {
        if (overlayRef.state() !== 'mounting') {
          animationDebugLog(`runtime ${config.id}`, `enter skipped (state "${overlayRef.state()}" before enter frame)`);

          return;
        }

        const lifecycle = getAnimatedLifecycle(componentRef);
        if (!lifecycle) {
          interactiveCloseReady = true;
          applyInitialFocus(paneElement, autoFocus, targetDocument);
          overlayRef.markOpened();

          return;
        }

        animationDebugLog(
          `runtime ${config.id}`,
          `enter (delegate ${config.animationDelegate?.enter ? 'yes' : 'no'}, lifecycle state "${lifecycle.state$.value}")`,
        );

        const readySubscription = lifecycle.state$
          .pipe(
            filter((state) => state === 'entering' || state === 'entered'),
            take(1),
          )
          .subscribe(() => {
            nextFrame(() => {
              interactiveCloseReady = true;
            });
          });
        cleanupFns.push(() => readySubscription.unsubscribe());

        if (config.animationDelegate?.enter) {
          config.animationDelegate.enter({ lifecycle, elements: overlayRef.elements });
        } else {
          lifecycle.enter();
        }

        lifecycle.state$
          .pipe(
            filter((state) => state === 'entered'),
            take(1),
          )
          .subscribe(() => {
            applyInitialFocus(paneElement, autoFocus, targetDocument);
            overlayRef.markOpened();
          });
      });

      return overlayRef;
    };

    destroyRef.onDestroy(() => {
      [...mountedTeardowns].forEach((teardown) => teardown());
      [...rootElements.keys()].forEach((targetDocument) => maybeDestroyRootElements(targetDocument));
    });

    return {
      mount,
      openEntries,
    };
  },
  { name: 'OverlayRuntime' },
);

export const provideOverlayRuntime = /* @__PURE__ */ toProvideFn(OVERLAY_RUNTIME_DEF);
export const injectOverlayRuntime = /* @__PURE__ */ toInjectFn(OVERLAY_RUNTIME_DEF);

import {
  ApplicationRef,
  DOCUMENT,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  computed,
  createComponent,
  inject,
  inputBinding,
  outputBinding,
  signal,
} from '@angular/core';
import { filter, take } from 'rxjs';
import { ANIMATED_LIFECYCLE_TOKEN, animationDebugLog, nextFrame } from '../animations';
import { injectRenderer } from '../providers';
import { createRootProvider } from '../utils';
import { applyInitialFocus, isHTMLElement, setupFocusTrap } from './overlay-focus';
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

    // Synchronous teardown for each currently-mounted overlay, run when the runtime's injector is
    // destroyed (app teardown). Registered on mount, removed once the overlay is destroyed normally.
    const mountedTeardowns = new Set<() => void>();

    const getRootElement = () => {
      if (rootElement) {
        return rootElement;
      }

      // A previous Angular app (e.g. the one that existed before a Storybook HMR update or story
      // switch) may have left its runtime root orphaned in <body> if it was torn down mid-animation.
      // Such a node keeps a backdrop/pane on screen and blocks pointer events, so clear any stragglers
      // before creating ours.
      document.querySelectorAll('.et-overlay-runtime-root').forEach((el) => el.remove());

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
      const autoFocus = config.autoFocus ?? 'first-tabbable';

      renderer.addClass(hostElement, 'et-overlay-runtime-entry');
      setBaseElementStyles(config as OverlayRuntimeMountConfig<object>, hostElement, paneElement, renderer);
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

      if (backdropElement) {
        renderer.addClass(backdropElement, 'et-overlay-runtime-backdrop');
        setBackdropStyles(backdropElement, renderer);
        renderer.setAttribute(backdropElement, 'data-overlay-id', config.id);
        (config.backdropClass ?? []).forEach((className) => renderer.addClass(backdropElement, className));
        renderer.appendChild(hostElement, backdropElement);
      }

      renderer.appendChild(hostElement, paneElement);
      renderer.appendChild(root, hostElement);

      const overlayRef = createOverlayRuntimeRef<TComponent, TResult>(
        config.id,
        { ...config },
        {
          rootElement: root,
          hostElement,
          backdropElement,
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
      const elementInjector = Injector.create({
        parent: parentInjector,
        providers: config.providers ?? [],
      });

      const componentRef = createComponent(config.component, {
        environmentInjector,
        elementInjector,
        hostElement: paneElement,
        bindings: [
          ...Object.entries(config.inputBindings ?? {}).map(([key, value]) => inputBinding(key, () => value)),
          ...Object.entries(config.outputBindings ?? {}).map(([key, listener]) => outputBinding(key, listener)),
        ],
      });

      // pane classes are applied after component creation — Angular replaces the host
      // element's class attribute with the component's static host class on creation
      renderer.addClass(paneElement, 'et-overlay-runtime-pane', ...(config.paneClass ?? []));

      appRef.attachView(componentRef.hostView);
      overlayRef.attachComponentRef(componentRef);
      overlayRef.beforeOpenedSubject.next();
      overlayRef.beforeOpenedSubject.complete();

      openEntriesState.update((entries) => [...entries, overlayRef as OverlayRuntimeRef<object, unknown>]);

      let positionCleanup = setupPositioning(
        config as OverlayRuntimeMountConfig<object>,
        hostElement,
        paneElement,
        overlayRef as OverlayRuntimeRef<object, unknown>,
        renderer,
      );
      cleanupFns.push(() => positionCleanup());

      let currentPositionStrategy = config.positionStrategy;
      const getOriginElement = () =>
        currentPositionStrategy?.kind === 'anchored' ? currentPositionStrategy.referenceElement : null;

      overlayRef.attachPositionUpdater((strategy) => {
        currentPositionStrategy = strategy;
        positionCleanup();
        resetPositioningStyles(config as OverlayRuntimeMountConfig<object>, hostElement, paneElement, renderer);
        positionCleanup = setupPositioning(
          { ...config, positionStrategy: strategy } as OverlayRuntimeMountConfig<object>,
          hostElement,
          paneElement,
          overlayRef as OverlayRuntimeRef<object, unknown>,
          renderer,
        );
      });

      const destroyMountedOverlay = (closeEvent: OverlayRuntimeCloseEvent<TResult>) => {
        animationDebugLog(`runtime ${config.id}`, `destroy (source "${closeEvent.source}")`);
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
          previousFocusedElement.focus({ preventScroll: true });
        }

        overlayRef.finishClose(closeEvent);
      };

      // Allows the runtime to synchronously destroy this overlay on app teardown, bypassing the
      // async leave animation (whose completion callback would never fire once the app is gone).
      const forceTeardown = () => destroyMountedOverlay({ result: undefined, source: 'api' });
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

        if (!lifecycle) {
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
          if (event.key !== 'Escape' || !isTopMost(overlayRef as OverlayRuntimeRef<object, unknown>)) {
            return;
          }

          if (!interactiveCloseReady) {
            animationDebugLog(`runtime ${config.id}`, 'escape ignored (enter transition has not started yet)');
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

            document.addEventListener('click', swallowReopenClick, { capture: true, once: true });
          }
        };

        document.addEventListener('pointerdown', onPointerDown, true);
        cleanupFns.push(() => document.removeEventListener('pointerdown', onPointerDown, true));
      }

      cleanupFns.push(
        setupFocusTrap(
          paneElement,
          overlayRef as OverlayRuntimeRef<object, unknown>,
          config.modal !== false,
          isTopMost,
          document,
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
          applyInitialFocus(paneElement, autoFocus, document);
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
            applyInitialFocus(paneElement, autoFocus, document);
            overlayRef.markOpened();
          });
      });

      return overlayRef;
    };

    destroyRef.onDestroy(() => {
      [...mountedTeardowns].forEach((teardown) => teardown());
      maybeDestroyRootElement();
    });

    return {
      mount,
      openEntries,
    };
  },
  { name: 'OverlayRuntime' },
);

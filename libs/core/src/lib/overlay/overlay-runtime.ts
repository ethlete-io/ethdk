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
  signal,
} from '@angular/core';
import { filter, take } from 'rxjs';
import { ANIMATED_LIFECYCLE_TOKEN, nextFrame } from '../animations';
import { injectRenderer } from '../providers';
import { createRootProvider } from '../utils';
import { applyInitialFocus, isHTMLElement, setupFocusTrap } from './overlay-focus';
import { setBackdropStyles, setBaseElementStyles, setupPositioning } from './overlay-position';
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
      renderer.addClass(paneElement, 'et-overlay-runtime-pane');
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
      renderer.addClass(paneElement, ...(config.paneClass ?? []));

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
        bindings: Object.entries(config.inputBindings ?? {}).map(([key, value]) => inputBinding(key, () => value)),
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
          renderer,
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
          previousFocusedElement.focus({ preventScroll: true });
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
          return;
        }

        const lifecycle = getAnimatedLifecycle(componentRef);
        if (!lifecycle) {
          applyInitialFocus(paneElement, autoFocus, document);
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
            applyInitialFocus(paneElement, autoFocus, document);
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

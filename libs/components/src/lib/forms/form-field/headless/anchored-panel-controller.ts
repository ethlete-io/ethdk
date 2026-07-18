import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Signal, untracked, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, Subscription, take, tap } from 'rxjs';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { OverlayTemplateHostComponent } from '../../../overlay/overlay-template-host.component';

export type AnchoredPanelSurfaceLike = { templateRef: unknown };

export type AnchoredPanelCloseInfo = {
  /** A deliberate pointerdown outside the panel and anchor closed it. */
  byOutsidePointer: boolean;
  /** The pane was presented as a bottom sheet (small viewport) when it closed. */
  fromBottomSheet: boolean;
};

export type AnchoredPanelOverlayRef = OverlayRef<OverlayTemplateHostComponent, unknown>;

export type CreateAnchoredPanelControllerOptions = {
  /**
   * Reconcile gate — while `false`, any mounted panel closes and `open` is forced `false`.
   * (Typically `!disabled`; `readonly` is enforced by the caller's `show()`, not here, so a panel
   * already open when the control turns read-only stays open, matching the pre-extraction behavior.)
   */
  canOpen: Signal<boolean>;
  /** The open model the panel mirrors; the controller drives it to `false` on every close. */
  open: WritableSignal<boolean>;
  /** The caller-owned overlay-ref signal the controller writes on mount/close (so the directive
   * can keep exposing its own `overlayRef`/`isMounted`). */
  overlayRef: WritableSignal<AnchoredPanelOverlayRef | null>;
  /** The registered surface template to project into the pane. */
  surface: Signal<AnchoredPanelSurfaceLike | null>;
  /** The element the pane anchors to (and whose pointerdowns must not count as "outside"). */
  anchor: () => HTMLElement | null | undefined;
  /** Builds the per-control overlay config (strategies, panel class, escape/focus flags, context). */
  config: (input: { origin: HTMLElement | undefined; templateRef: unknown }) => OverlayConfig;
  /** Runs after the surface is resolved but before the pane mounts (e.g. reset browse state). */
  onBeforeMount?: () => void;
  /** Runs right after the pane mounts (e.g. seed focus, emit `opened`). */
  onMounted?: (overlayRef: AnchoredPanelOverlayRef) => void;
  /** Runs when a close begins, before the leave animation (e.g. clear a search query). */
  onBeforeClosed?: () => void;
  /** Runs once the pane is gone (e.g. restore focus to the field). */
  onAfterClosed?: (info: AnchoredPanelCloseInfo) => void;
  /** An extra document `keydown` listener installed while the panel is open (e.g. select's Escape). */
  onDocumentKeydown?: (event: KeyboardEvent) => void;
  /** Dev-mode handler for a mount attempted without a registered surface. */
  onMissingSurface?: () => void;
};

/**
 * The anchored/bottom-sheet panel machinery shared by the field controls that open a templated
 * overlay from a trigger (`select`, `cascader`; the date pickers use the sibling
 * `createDatePickerOverlay`). It owns the overlay ref, the disabled/open reconciliation effect,
 * the outside-pointer close (so a pointerdown on the anchor toggles instead of close-and-reopen),
 * and the model sync on every interactive close. Everything control-specific — the overlay config
 * and the mount/close side effects — is supplied via the hooks. Call in an injection context.
 */
export const createAnchoredPanelController = (options: CreateAnchoredPanelControllerOptions) => {
  const overlayManager = injectOverlayManager();
  const documentRef = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);

  const overlayRef = options.overlayRef;

  let interactionListenersCleanup: (() => void) | null = null;
  let closedByOutsidePointer = false;
  let closedFromBottomSheet = false;

  const detachInteractionListeners = () => {
    interactionListenersCleanup?.();
    interactionListenersCleanup = null;
  };

  const attachInteractionListeners = () => {
    detachInteractionListeners();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const pane = overlayRef()?.elements?.paneElement;

      if (pane?.contains(target)) {
        return;
      }

      if (options.anchor()?.contains(target)) {
        return;
      }

      closedByOutsidePointer = true;

      if (options.open()) {
        options.open.set(false);
      } else {
        overlayRef()?.close();
      }
    };

    const subscriptions: Subscription[] = [
      fromEvent<PointerEvent>(documentRef, 'pointerdown', { capture: true }).subscribe(onPointerDown),
    ];

    if (options.onDocumentKeydown) {
      subscriptions.push(fromEvent<KeyboardEvent>(documentRef, 'keydown').subscribe(options.onDocumentKeydown));
    }

    interactionListenersCleanup = () => subscriptions.forEach((subscription) => subscription.unsubscribe());
  };

  const mountOverlay = () => {
    const surface = options.surface();

    if (!surface) {
      options.onMissingSurface?.();

      return;
    }

    options.onBeforeMount?.();

    const config = options.config({ origin: options.anchor() ?? undefined, templateRef: surface.templateRef });
    const currentRef = overlayManager.open<OverlayTemplateHostComponent>(OverlayTemplateHostComponent, config);

    overlayRef.set(currentRef);
    options.onMounted?.(currentRef);
    attachInteractionListeners();

    // sync the open model as soon as any close begins so aria-expanded flips before the leave animation
    currentRef
      .beforeClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap(() => {
          if (overlayRef() !== currentRef) {
            return;
          }

          detachInteractionListeners();

          // read while the pane still exists — afterClosed fires after its removal
          closedFromBottomSheet =
            currentRef.elements?.paneElement?.classList.contains('et-overlay--bottom-sheet') ?? false;

          options.onBeforeClosed?.();

          if (options.open()) {
            options.open.set(false);
          }
        }),
      )
      .subscribe();

    currentRef
      .afterClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap(() => {
          if (overlayRef() !== currentRef) {
            return;
          }

          overlayRef.set(null);

          const info: AnchoredPanelCloseInfo = {
            byOutsidePointer: closedByOutsidePointer,
            fromBottomSheet: closedFromBottomSheet,
          };

          closedByOutsidePointer = false;
          closedFromBottomSheet = false;
          options.onAfterClosed?.(info);
        }),
      )
      .subscribe();
  };

  effect(() => {
    const canOpen = options.canOpen();
    const shouldBeOpen = options.open();
    const currentRef = overlayRef();

    if (!canOpen) {
      if (currentRef) {
        untracked(() => currentRef.close());
      }

      if (shouldBeOpen) {
        untracked(() => options.open.set(false));
      }

      return;
    }

    if (shouldBeOpen && !currentRef) {
      untracked(() => mountOverlay());

      return;
    }

    if (!shouldBeOpen && currentRef) {
      untracked(() => currentRef.close());
    }
  });

  destroyRef.onDestroy(() => {
    detachInteractionListeners();
    overlayRef()?.close();
  });

  return {
    /** Closes the pane (the reconcile effect and close hooks handle the rest). */
    close: () => overlayRef()?.close(),
  };
};

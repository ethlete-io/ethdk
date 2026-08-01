import { ElementRef } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { OverlayRef } from './overlay-ref';

export const getClosestOverlay = (element: ElementRef<HTMLElement>, openOverlays: OverlayRef<object, unknown>[]) => {
  const nativeElement = element.nativeElement;

  return openOverlays.find((overlay) => overlay.elements?.paneElement.contains(nativeElement)) ?? null;
};

const resolveOriginElement = (origin: HTMLElement | Event | undefined): Element | null => {
  if (origin instanceof HTMLElement) {
    return origin;
  }

  if (origin instanceof Event && origin.target instanceof Element) {
    return origin.target;
  }

  return null;
};

export type OverlayTreeContainmentOptions = {
  /** The pointerdown/click target to test. */
  target: Node;
  /** The panel whose tree defines "inside" - typically the anchored panel's own pane. */
  rootPane: HTMLElement;
  /** All currently open overlays (from the overlay manager). */
  openOverlays: OverlayRef<object, unknown>[];
};

/**
 * True when `target` is inside `rootPane` or inside any open overlay transitively anchored from
 * within it. A nested popover (a select body, menu, tooltip, …) opened from inside a panel mounts
 * as a sibling pane in the overlay root - not a DOM descendant - so a plain `pane.contains(target)`
 * misses it. An anchored panel uses this so a pointerdown in a child popover it opened does not read
 * as an outside-close. Nesting is resolved by each overlay's `origin` (its anchor/trigger element)
 * living inside an ancestor pane, so popovers nested several levels deep are covered.
 */
export const isTargetInsideOverlayTree = ({ target, rootPane, openOverlays }: OverlayTreeContainmentOptions) => {
  const treePanes = new Set<HTMLElement>([rootPane]);

  // Grow the set until no newly-anchored pane is added - an overlay whose origin sits inside a pane
  // already in the tree is itself part of the tree, and may in turn anchor deeper ones.
  let grew = true;
  while (grew) {
    grew = false;

    for (const overlay of openOverlays) {
      const pane = overlay.elements?.paneElement;

      if (!pane || treePanes.has(pane)) {
        continue;
      }

      const originElement = resolveOriginElement(overlay.config.origin);

      if (originElement && [...treePanes].some((treePane) => treePane.contains(originElement))) {
        treePanes.add(pane);
        grew = true;
      }
    }
  }

  return [...treePanes].some((pane) => pane.contains(target));
};

export type ResolveClosestOverlayOptions = {
  overlayRef: OverlayRef<object, unknown> | null;
  element: ElementRef<HTMLElement>;
  openOverlays: OverlayRef<object, unknown>[];
};

/** Returns the given ref or resolves the overlay the element is rendered inside of. Throws if neither exists. */
export const resolveClosestOverlay = (options: ResolveClosestOverlayOptions): OverlayRef<object, unknown> => {
  const { overlayRef, element, openOverlays } = options;
  const resolved = overlayRef ?? getClosestOverlay(element, openOverlays);

  if (!resolved) {
    throw new RuntimeError(
      OVERLAY_ERROR_CODES.NO_CLOSEST_OVERLAY,
      '[Overlay] No overlay found. The element must be rendered inside an open overlay.',
    );
  }

  return resolved;
};

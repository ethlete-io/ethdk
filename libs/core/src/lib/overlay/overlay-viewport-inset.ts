import { DEFAULT_OVERLAY_LAYER, resolveOverlayLayer } from './overlay-layer';

/** The space each viewport edge has reserved, in px. */
export type OverlayViewportInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type OverlayViewportReservation = Partial<OverlayViewportInset> & {
  /**
   * The stacking level the reserving surface paints at. Only overlays below it keep out of the
   * reserved space - a menu opened inside the surface itself is above the surface and may use it.
   * Defaults to one level above {@link DEFAULT_OVERLAY_LAYER}.
   */
  layer?: number;
};

const NO_INSET: OverlayViewportInset = { top: 0, right: 0, bottom: 0, left: 0 };

const reservations = /* @__PURE__ */ new Set<Required<OverlayViewportReservation>>();
const listeners = /* @__PURE__ */ new Set<() => void>();

/**
 * The custom property each edge is published as on the document root, so page chrome that overlays
 * cannot move for you - a sticky action bar, a floating button - can keep out of the same space:
 * `inset-block-end: calc(1.6rem + var(--et-viewport-inset-bottom, 0px))`.
 */
const INSET_PROPERTIES = {
  top: '--et-viewport-inset-top',
  right: '--et-viewport-inset-right',
  bottom: '--et-viewport-inset-bottom',
  left: '--et-viewport-inset-left',
} as const satisfies Record<keyof OverlayViewportInset, string>;

/**
 * Page content paints below every reserving surface, so - unlike an overlay - it keeps out of every
 * reservation, whichever level it was made on.
 */
const publishInsetProperties = () => {
  const root = globalThis.document?.documentElement;

  if (!root) return;

  const insets = overlayViewportInsets(Number.NEGATIVE_INFINITY);

  Object.entries(INSET_PROPERTIES).forEach(([edge, property]) => {
    if (!reservations.size) {
      root.style.removeProperty(property);

      return;
    }

    root.style.setProperty(property, `${insets[edge as keyof OverlayViewportInset]}px`);
  });
};

const notify = () => {
  publishInsetProperties();
  listeners.forEach((listener) => listener());
};

/**
 * Reserves an edge of the viewport, so overlays keep out of it. Returns the release callback.
 *
 * Meant for a surface an application paints over its own content and above the overlay layer - a
 * docked devtools panel, an always-on-top widget. A centered or globally positioned overlay is laid
 * out inside what is left of the viewport, and an anchored one avoids the reserved edge the same way
 * it avoids the viewport edge. Page chrome that nothing can move for you - a sticky action bar, a
 * floating button - reads the published `--et-viewport-inset-*` custom properties instead.
 */
export const reserveOverlayViewportSpace = (reservation: OverlayViewportReservation) => {
  const entry: Required<OverlayViewportReservation> = {
    top: reservation.top ?? 0,
    right: reservation.right ?? 0,
    bottom: reservation.bottom ?? 0,
    left: reservation.left ?? 0,
    layer: reservation.layer ?? DEFAULT_OVERLAY_LAYER + 1,
  };

  reservations.add(entry);
  notify();

  return () => {
    if (!reservations.delete(entry)) return;

    notify();
  };
};

/**
 * What an overlay on this stacking level must keep out of: the largest reservation per edge made by a
 * surface that paints above it. Reservations on or below the level are ignored - they cannot cover it.
 */
export const overlayViewportInsets = (layer = DEFAULT_OVERLAY_LAYER): OverlayViewportInset => {
  let insets = NO_INSET;

  reservations.forEach((reservation) => {
    if (reservation.layer <= layer) return;

    insets = {
      top: Math.max(insets.top, reservation.top),
      right: Math.max(insets.right, reservation.right),
      bottom: Math.max(insets.bottom, reservation.bottom),
      left: Math.max(insets.left, reservation.left),
    };
  });

  return insets;
};

/** {@link overlayViewportInsets} for the stacking level `element` is rendered on. */
export const overlayViewportInsetsFor = (element: Element) => overlayViewportInsets(resolveOverlayLayer(element));

/**
 * Runs `listener` whenever a reservation is made or released, so an already positioned overlay can be
 * laid out again. Returns the unsubscribe callback.
 *
 * @internal
 */
export const onOverlayViewportInsetsChange = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

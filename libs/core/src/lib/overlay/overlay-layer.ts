/**
 * Attribute an element uses to declare the stacking level it paints at. Its value is the z-index of
 * the runtime root an overlay opened from inside it mounts into, and the level every outside-pointer
 * close compares a press against.
 */
export const OVERLAY_LAYER_ATTRIBUTE = 'data-et-overlay-layer';

/**
 * The stacking level overlays mount at when nothing above their origin declares another one. Near
 * int32 max, so an overlay outranks an arbitrary host application's own stacking.
 */
export const DEFAULT_OVERLAY_LAYER = 2147483003;

/**
 * The stacking level for an overlay opened from `element`: the one declared by the nearest ancestor
 * carrying `data-et-overlay-layer`, or {@link DEFAULT_OVERLAY_LAYER}.
 *
 * Put the attribute on anything that paints above the default overlay layer - a devtools panel, an
 * always-on-top widget - so a menu, tooltip or dialog opened inside it is not rendered behind the
 * thing that opened it, and so working in it does not close an overlay below it. Overlays sharing a
 * level share a runtime root and stack in open order.
 */
export const resolveOverlayLayer = (element: Element | null | undefined) => {
  const declaring = element?.closest?.(`[${OVERLAY_LAYER_ATTRIBUTE}]`);

  if (!declaring) {
    return DEFAULT_OVERLAY_LAYER;
  }

  const declared = declaring.getAttribute(OVERLAY_LAYER_ATTRIBUTE)?.trim();
  const layer = Number(declared);

  if (!declared || !Number.isFinite(layer)) {
    return DEFAULT_OVERLAY_LAYER;
  }

  return layer;
};

/**
 * Whether `target` sits on a stacking level above `layer` - a press inside the query devtools panel
 * while an application overlay is open, for example.
 *
 * Every outside-pointer close asks this first: a press on a surface that paints over an overlay is
 * aimed at that surface, not at the content the overlay covers, so it must not close the overlay.
 * The level of a press inside another overlay resolves through that overlay's runtime root, so a
 * menu opened from the devtools panel counts as part of the panel's level too.
 */
export const isOnHigherOverlayLayer = (target: EventTarget | null | undefined, layer: number) => {
  if (!(target instanceof Element)) {
    return false;
  }

  return resolveOverlayLayer(target) > layer;
};

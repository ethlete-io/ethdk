/**
 * Attribute an element uses to declare the stacking level of every overlay opened from inside it.
 * Its value is the z-index of the runtime root such an overlay mounts into.
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
 * thing that opened it. Overlays sharing a level share a runtime root and stack in open order.
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

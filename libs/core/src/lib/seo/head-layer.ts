export type HeadLayerOptions = {
  /**
   * `'overlay'` bindings always outrank `'page'` bindings, whatever the creation order. Within a layer the binding
   * created last wins.
   * @default 'page'
   */
  layer?: 'page' | 'overlay';
};

const OVERLAY_PRIORITY_BAND = 2 ** 32;

export const layerPriority = (layer: HeadLayerOptions['layer'], claimedPriority: number) =>
  layer === 'overlay' ? OVERLAY_PRIORITY_BAND + claimedPriority : claimedPriority;

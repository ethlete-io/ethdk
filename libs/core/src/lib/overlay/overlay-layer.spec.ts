import { DEFAULT_OVERLAY_LAYER, OVERLAY_LAYER_ATTRIBUTE, resolveOverlayLayer } from './overlay-layer';

describe('resolveOverlayLayer', () => {
  const createTree = (layer?: string) => {
    const declaring = document.createElement('div');
    const child = document.createElement('button');

    if (layer !== undefined) {
      declaring.setAttribute(OVERLAY_LAYER_ATTRIBUTE, layer);
    }

    declaring.append(child);

    return child;
  };

  it('falls back to the default level without an element', () => {
    expect(resolveOverlayLayer(null)).toBe(DEFAULT_OVERLAY_LAYER);
    expect(resolveOverlayLayer(undefined)).toBe(DEFAULT_OVERLAY_LAYER);
  });

  it('falls back to the default level when nothing above declares one', () => {
    expect(resolveOverlayLayer(createTree())).toBe(DEFAULT_OVERLAY_LAYER);
  });

  it('reads the level from the nearest declaring ancestor', () => {
    expect(resolveOverlayLayer(createTree('2147483020'))).toBe(2147483020);
  });

  it('reads a level declared on the element itself', () => {
    const element = document.createElement('div');
    element.setAttribute(OVERLAY_LAYER_ATTRIBUTE, '42');

    expect(resolveOverlayLayer(element)).toBe(42);
  });

  it('falls back to the default level for an unparsable value', () => {
    expect(resolveOverlayLayer(createTree('above-everything'))).toBe(DEFAULT_OVERLAY_LAYER);
    expect(resolveOverlayLayer(createTree(''))).toBe(DEFAULT_OVERLAY_LAYER);
  });
});

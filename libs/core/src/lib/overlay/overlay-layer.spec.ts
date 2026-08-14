import {
  DEFAULT_OVERLAY_LAYER,
  isOnHigherOverlayLayer,
  OVERLAY_LAYER_ATTRIBUTE,
  resolveOverlayLayer,
} from './overlay-layer';

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

describe('isOnHigherOverlayLayer', () => {
  const createTarget = (layer?: number) => {
    const declaring = document.createElement('div');
    const target = document.createElement('button');

    if (layer !== undefined) {
      declaring.setAttribute(OVERLAY_LAYER_ATTRIBUTE, `${layer}`);
    }

    declaring.append(target);

    return target;
  };

  it('is true for a target on a level above the given one', () => {
    expect(isOnHigherOverlayLayer(createTarget(DEFAULT_OVERLAY_LAYER + 10), DEFAULT_OVERLAY_LAYER)).toBe(true);
  });

  it('is false for a target on the same level', () => {
    expect(isOnHigherOverlayLayer(createTarget(DEFAULT_OVERLAY_LAYER), DEFAULT_OVERLAY_LAYER)).toBe(false);
    expect(isOnHigherOverlayLayer(createTarget(), DEFAULT_OVERLAY_LAYER)).toBe(false);
  });

  it('is false for a target on a level below the given one', () => {
    expect(isOnHigherOverlayLayer(createTarget(), DEFAULT_OVERLAY_LAYER + 10)).toBe(false);
  });

  it('is false without an element', () => {
    expect(isOnHigherOverlayLayer(null, DEFAULT_OVERLAY_LAYER)).toBe(false);
    expect(isOnHigherOverlayLayer(undefined, DEFAULT_OVERLAY_LAYER)).toBe(false);
    expect(isOnHigherOverlayLayer(document.createTextNode('text'), DEFAULT_OVERLAY_LAYER)).toBe(false);
  });
});

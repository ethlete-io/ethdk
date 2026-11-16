const foreignLayerOwners = /* @__PURE__ */ new WeakMap<Element, Element>();

/**
 * Marks `foreignLayer` - a panel another library renders outside the overlay DOM, e.g. an Angular CDK
 * select panel - as part of the SDK overlay `owner` sits in. A press inside it then counts as a press
 * inside that overlay, so it does not close it. Call the returned function when the layer goes away.
 */
export const markInsideOverlay = (foreignLayer: Element, owner: Element) => {
  foreignLayerOwners.set(foreignLayer, owner);

  return () => {
    if (foreignLayerOwners.get(foreignLayer) === owner) {
      foreignLayerOwners.delete(foreignLayer);
    }
  };
};

export function* overlayAncestors(element: Element | null | undefined) {
  const visited = new Set<Element>();
  let current = element ?? null;

  while (current && !visited.has(current)) {
    visited.add(current);

    yield current;

    current = foreignLayerOwners.get(current) ?? current.parentElement;
  }
}

export const overlayContains = (container: Element, target: Element) => {
  for (const ancestor of overlayAncestors(target)) {
    if (ancestor === container) {
      return true;
    }
  }

  return false;
};

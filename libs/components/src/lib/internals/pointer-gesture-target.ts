/** Elements whose own pointer handling wins over a drag gesture on an ancestor. */
export const isInteractivePointerTarget = (target: HTMLElement) => {
  const tag = target.tagName.toLowerCase();

  return tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a';
};

/** `touch-action` values that leave the axis to whatever wants to pan on it. */
const PANNABLE_TOUCH_ACTIONS = {
  x: ['auto', 'manipulation', 'pan-x', 'pan-left', 'pan-right'],
  y: ['auto', 'manipulation', 'pan-y', 'pan-up', 'pan-down'],
} as const;

/**
 * Whether something between the pointer and `boundary` has taken `axis` for its own gesture - a
 * color picker area at `touch-action: none`, a vertical slider at `pan-x`. That is the same
 * declaration the browser intersects up the tree to decide who gets a touch, so honoring it keeps
 * one answer for both: a drag starting on such a surface belongs to it, not to the boundary.
 */
export const claimsPointerAxis = (target: HTMLElement, options: { boundary: HTMLElement; axis: 'x' | 'y' }) => {
  const pannable = PANNABLE_TOUCH_ACTIONS[options.axis];

  for (let node: HTMLElement | null = target; node && node !== options.boundary; node = node.parentElement) {
    const touchAction = getComputedStyle(node).touchAction;

    if (!pannable.some((value) => touchAction.includes(value))) return true;
  }

  return false;
};

type SuppressionState = { count: number; previousUserSelect: string; previousWebkitUserSelect: string };

const suppressions = /* @__PURE__ */ new WeakMap<Document, SuppressionState>();

/**
 * Stop the browser from starting a text selection, until the returned function is called.
 *
 * Pointer-driven gestures (drag, resize, scrub) otherwise sweep a selection across everything the
 * pointer passes over. Call this when the gesture starts and release it when the gesture ends -
 * including when it is cancelled, or the page stays unselectable.
 *
 * Nested or concurrent calls are counted, so the last release restores the document's original
 * inline `user-select`. Releasing twice is a no-op.
 */
export const suppressTextSelection = (doc: Document): (() => void) => {
  const existing = suppressions.get(doc);

  if (existing) {
    existing.count++;
  } else {
    const style = doc.documentElement.style;

    suppressions.set(doc, {
      count: 1,
      previousUserSelect: style.userSelect,
      previousWebkitUserSelect: style.webkitUserSelect,
    });
    style.userSelect = 'none';
    // Safari and WebKitGTK ignore the unprefixed `user-select`.
    style.webkitUserSelect = 'none';
  }

  let released = false;

  return () => {
    const state = suppressions.get(doc);

    if (released || !state) return;

    released = true;
    state.count--;

    if (state.count > 0) return;

    suppressions.delete(doc);
    doc.documentElement.style.userSelect = state.previousUserSelect;
    doc.documentElement.style.webkitUserSelect = state.previousWebkitUserSelect;
  };
};

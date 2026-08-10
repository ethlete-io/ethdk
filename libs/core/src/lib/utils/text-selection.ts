type SuppressionState = { count: number; previousInlineValue: string };

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
    suppressions.set(doc, { count: 1, previousInlineValue: doc.documentElement.style.userSelect });
    doc.documentElement.style.userSelect = 'none';
  }

  let released = false;

  return () => {
    const state = suppressions.get(doc);

    if (released || !state) return;

    released = true;
    state.count--;

    if (state.count > 0) return;

    suppressions.delete(doc);
    doc.documentElement.style.userSelect = state.previousInlineValue;
  };
};

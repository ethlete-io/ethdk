import { effect, Signal } from '@angular/core';
import { injectRenderer, OverlayRuntimeRef } from '@ethlete/core';
import { OverlayRef } from './overlay-ref';

export const STACKED_SHEET_CLASS = 'et-overlay--stacked';

export const markStackedBottomSheets = (
  openEntries: Signal<OverlayRuntimeRef<object, unknown>[]>,
  toOverlayRef: (runtimeRef: OverlayRuntimeRef<object, unknown>) => OverlayRef<object, unknown> | undefined,
) => {
  const renderer = injectRenderer();
  let stacked = new Set<HTMLElement>();

  effect(() => {
    const sheets = openEntries()
      .filter((entry) => entry.state() !== 'closing' && entry.state() !== 'closed')
      .filter((entry) => toOverlayRef(entry)?.layout() === 'bottom-sheet')
      .map((entry) => entry.elements.paneElement);

    const next = new Set(sheets.slice(0, -1));

    for (const pane of stacked) {
      if (!next.has(pane)) renderer.removeClass(pane, STACKED_SHEET_CLASS);
    }
    for (const pane of next) {
      renderer.addClass(pane, STACKED_SHEET_CLASS);
    }

    stacked = next;
  });
};

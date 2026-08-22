import { ComponentFixture } from '@angular/core/testing';
import { fakeLayout, fakeResizeObserver } from '../../testing/fake-layout';
import { tick } from '../../testing/driver-core';

export type GridBreakpointName = 'sm' | 'md' | 'lg';

export type GridBreakpointWidths = Record<GridBreakpointName, number>;

const DEFAULT_BREAKPOINT_WIDTHS: GridBreakpointWidths = { sm: 400, md: 800, lg: 1216 };

export type GridHarnessOptions = {
  /** The `.et-grid` container's initial measured width, in px. Defaults to the `lg` breakpoint. */
  width?: number;
  /** Overrides the widths `measure()`'s breakpoint names resolve to. */
  breakpoints?: Partial<GridBreakpointWidths>;
};

export type GridHarness = {
  /**
   * Re-measures the `.et-grid` container at `target` (a width in px, or one of `breakpoints`'
   * names) and fires the resize observer `signalHostElementDimensions` is waiting on, settling
   * `fixture` afterwards. Omit `target` to re-deliver the current width.
   */
  measure: (fixture: ComponentFixture<unknown>, target?: number | GridBreakpointName) => void;
};

/**
 * Fakes the `.et-grid` container's `clientWidth` and installs a fireable `ResizeObserver` - jsdom
 * reports every element as zero-width, so `GridDirective` can never leave `isReady() === false`
 * without both. The width fake only takes effect once `measure()` is first called, not from
 * construction: `GridDirective` gates its one-shot animation enablement on its first measurement,
 * so a spec asserting the pre-measurement state must still see a real, unmeasured container.
 */
export const createGridHarness = ({
  width = DEFAULT_BREAKPOINT_WIDTHS.lg,
  breakpoints,
}: GridHarnessOptions = {}): GridHarness => {
  const widths = { ...DEFAULT_BREAKPOINT_WIDTHS, ...breakpoints };
  let currentWidth = width;
  let widthIsFaked = false;

  const resizeObserver = fakeResizeObserver();

  const measure: GridHarness['measure'] = (fixture, target) => {
    if (target !== undefined) {
      currentWidth = typeof target === 'number' ? target : widths[target];
    }

    if (!widthIsFaked) {
      widthIsFaked = true;
      fakeLayout([{ match: '.et-grid', clientWidth: () => currentWidth }]);
    }

    tick();
    resizeObserver.fire();
    fixture.detectChanges();
  };

  return { measure };
};

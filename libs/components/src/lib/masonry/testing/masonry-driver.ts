import { ComponentFixture } from '@angular/core/testing';
import { fakeLayout, fakeResizeObserver } from '../../testing/fake-layout';

export type MasonryHarnessOptions = {
  /** The `.et-masonry` container's measured width, in px. */
  containerWidth?: number;
  /**
   * How much wider than its assigned width an item reports itself - what a padded card does
   * under `content-box`, where no measurement can ever match the assignment. Defaults to 0.
   */
  borderBoxOverflow?: number;
  /** Reads an item's height off the element. Defaults to the `data-test-height` attribute. */
  heights?: (item: HTMLElement) => number;
};

export type MasonryHarness = {
  /**
   * Delivers the container's width, then the items' widths at that width - the two-step handshake
   * a real layout produces, settling `fixture` after each.
   */
  settle: (fixture: ComponentFixture<unknown>) => void;
};

const defaultHeight = (item: HTMLElement) => Number(item.dataset['testHeight'] ?? 0);

/**
 * Fakes the `.et-masonry` container's width and its items' geometry for the rest of the current
 * test, and installs a fireable `ResizeObserver` - jsdom performs no layout, so the container's
 * `clientWidth` and every item's `getBoundingClientRect()` report zero without this. An item's
 * width comes from the inline width the masonry itself assigns (`item.style.width`), which is
 * what lets the real `isMeasured` handshake run; its height comes from `heights`.
 */
export const createMasonryHarness = ({
  containerWidth = 1000,
  borderBoxOverflow = 0,
  heights = defaultHeight,
}: MasonryHarnessOptions = {}): MasonryHarness => {
  fakeLayout([
    { match: '.et-masonry', clientWidth: containerWidth },
    {
      match: '.et-masonry-item',
      rect: (item) => ({
        width: (Number.parseFloat((item as HTMLElement).style.width) || 0) + borderBoxOverflow,
        height: heights(item as HTMLElement),
      }),
    },
  ]);

  const resizeObserver = fakeResizeObserver();

  const settle = (fixture: ComponentFixture<unknown>) => {
    resizeObserver.fire();
    fixture.detectChanges();
    resizeObserver.fire();
    fixture.detectChanges();
  };

  return { settle };
};

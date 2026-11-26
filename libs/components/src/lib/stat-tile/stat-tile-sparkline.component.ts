import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { createLinePath, splitLineSegments } from '../chart/headless/internals/chart-line';
import { numberExtent } from '../chart/headless/internals/chart-scale';

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;
const VIEW_PADDING = 4;

type SparklinePoint = { x: number; y: number };

/**
 * A label-free trend line for a stat tile: the series in the de-emphasis colour, its last value marked in the
 * accent. Decorative - the tile's value, delta and caption carry the reading, so it is hidden from assistive tech.
 *
 * @example
 * <et-stat-tile label="Sessions" [value]="12840">
 *   <et-stat-tile-sparkline [values]="[9, 11, 10, 12, 14, 13]" />
 * </et-stat-tile>
 */
@Component({
  selector: 'et-stat-tile-sparkline',
  template: `
    <svg
      [attr.viewBox]="VIEW_BOX"
      class="et-stat-tile-sparkline-svg"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="geometry().line" class="et-stat-tile-sparkline-line" />
      @if (geometry().current; as current) {
        <path [attr.d]="'M' + current.x + ',' + current.y + 'h0'" class="et-stat-tile-sparkline-current" />
      }
    </svg>
  `,
  styleUrl: './stat-tile-sparkline.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-stat-tile-sparkline',
    'aria-hidden': 'true',
  },
})
export class StatTileSparklineComponent {
  /** The series, oldest first. `null` leaves a gap. */
  public values = input.required<readonly (number | null)[]>();

  protected readonly VIEW_BOX = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;

  protected geometry = computed(() => {
    const values = this.values();
    const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
    const [min, max] = numberExtent(finite);
    const span = max - min;
    const step = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0;
    const plotHeight = VIEW_HEIGHT - VIEW_PADDING * 2;

    const points = values.map((value, index): SparklinePoint | null => {
      if (value === null || !Number.isFinite(value)) return null;

      const ratio = span ? (value - min) / span : 0.5;

      return { x: values.length > 1 ? index * step : VIEW_WIDTH / 2, y: VIEW_PADDING + (1 - ratio) * plotHeight };
    });

    const current = [...points].reverse().find((point) => point !== null) ?? null;

    return { line: createLinePath(splitLineSegments(points)), current };
  });
}

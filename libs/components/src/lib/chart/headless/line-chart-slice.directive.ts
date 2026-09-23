import { computed, DestroyRef, Directive, inject, input, numberAttribute } from '@angular/core';
import { injectHostElement } from '@ethlete/core';
import { TooltipDirective } from '../../tooltip/headless/tooltip.directive';
import { LineChartDirective } from './line-chart.directive';

/**
 * One x of an `etLineChart`: the hover, tap and focus target whose tooltip reads out every series.
 * The chart's slices share one tab stop; the arrow keys, Home and End move between them, and a touch
 * drag across the plot opens the slice under the finger.
 *
 * @example
 * @for (slice of chart.slices(); track slice.key) {
 *   <svg:g [etLineChartSlice]="slice.index" [etLineChartSliceTooltip]="tooltip" [etLineChartSliceDescription]="slice.description">…</svg:g>
 * }
 */
@Directive({
  selector: '[etLineChartSlice]',
  exportAs: 'etLineChartSlice',
  hostDirectives: [
    {
      directive: TooltipDirective,
      inputs: [
        'etTooltip: etLineChartSliceTooltip',
        'etTooltipAriaDescription: etLineChartSliceDescription',
        'anchor: etLineChartSliceAnchor',
        'placement: etLineChartSlicePlacement',
        'showDelay: etLineChartSliceShowDelay',
      ],
    },
  ],
  host: {
    role: 'img',
    '[attr.tabindex]': 'isTabStop() ? 0 : -1',
    '[attr.data-active]': 'tooltip.overlayRef() ? "" : null',
    '(click)': 'tooltip.show()',
    '(focus)': 'chart?.markTabStop(index())',
    '(keydown)': 'moveFocus($event)',
  },
})
export class LineChartSliceDirective {
  protected chart = inject(LineChartDirective, { optional: true });
  protected tooltip = inject(TooltipDirective);
  private element = injectHostElement<HTMLElement | SVGElement>();

  /** The slice's position in the chart's `slices()`. */
  public index = input.required({ alias: 'etLineChartSlice', transform: numberAttribute });

  protected isTabStop = computed(() => (this.chart?.tabStopIndex() ?? 0) === this.index());

  constructor() {
    const unregister = this.chart?.registerSlice({
      element: this.element,
      index: this.index,
      focus: () => this.element.focus(),
      showTooltip: () => this.tooltip.show(),
      hideTooltip: () => this.tooltip.hide(),
    });

    if (unregister) inject(DestroyRef).onDestroy(unregister);
  }

  protected moveFocus(event: KeyboardEvent) {
    const chart = this.chart;

    if (!chart) return;

    const index = this.index();
    const target =
      event.key === 'ArrowLeft'
        ? index - 1
        : event.key === 'ArrowRight'
          ? index + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? Number.MAX_SAFE_INTEGER
              : null;

    if (target === null) return;

    event.preventDefault();
    chart.focusSlice(target);
  }
}

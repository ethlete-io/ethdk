import { computed, DestroyRef, Directive, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { filter, fromEvent, switchMap, tap } from 'rxjs';
import { TooltipDirective } from '../../tooltip/headless/tooltip.directive';
import { LineChartDirective } from './line-chart.directive';

/**
 * One x of an `etLineChart`: the hover, tap and focus target whose tooltip reads out every series.
 * The show delay applies only while no slice tooltip is open; moving to another x moves an open tooltip at once.
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

  private isHovered = signal(false);

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

    toObservable(this.tooltip.overlayRef)
      .pipe(
        filter((overlayRef) => overlayRef !== null),
        tap(() => this.chart?.setSkipsShowDelay(true)),
        switchMap((overlayRef) => overlayRef.beforeClosed()),
        filter(() => this.isHovered()),
        tap(() => this.chart?.setSkipsShowDelay(false)),
        takeUntilDestroyed(),
      )
      .subscribe();

    fromEvent<PointerEvent>(this.element, 'pointerenter')
      .pipe(
        filter((event) => event.pointerType !== 'touch'),
        tap(() => {
          this.isHovered.set(true);

          if (this.chart?.skipsShowDelay()) this.tooltip.show();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    fromEvent<PointerEvent>(this.element, 'pointerout')
      .pipe(
        filter((event) => !(event.relatedTarget instanceof Node) || !this.element.contains(event.relatedTarget)),
        tap(() => this.isHovered.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe();
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

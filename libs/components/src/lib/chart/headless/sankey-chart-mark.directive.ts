import { computed, DestroyRef, Directive, inject, input } from '@angular/core';
import { injectHostElement } from '@ethlete/core';
import { SankeyChartActiveMark, SankeyChartDirective } from './sankey-chart.directive';

/**
 * A node or link of an `etSankeyChart`. The chart's marks share one tab stop: the arrow keys walk the
 * nodes, Enter steps into a node's outgoing links, ↑ and ↓ cycle them and Escape returns to the node.
 *
 * @example
 * <svg:g etSankeyChartMark="node" [etSankeyChartMarkKey]="node.key">…</svg:g>
 * <svg:g etSankeyChartMark="link" [etSankeyChartMarkKey]="link.key">…</svg:g>
 */
@Directive({
  selector: '[etSankeyChartMark]',
  exportAs: 'etSankeyChartMark',
  host: {
    role: 'img',
    '[attr.tabindex]': 'isTabStop() ? 0 : -1',
    '(focus)': 'chart.focusMark(mark())',
    '(blur)': 'chart.blurMark(key())',
    '(keydown)': 'chart.moveFocus($event, mark())',
  },
})
export class SankeyChartMarkDirective {
  protected chart = inject(SankeyChartDirective);

  public kind = input.required<SankeyChartActiveMark['kind']>({ alias: 'etSankeyChartMark' });

  /** The node's id or the link's `key`. */
  public key = input.required<string>({ alias: 'etSankeyChartMarkKey' });

  protected mark = computed<SankeyChartActiveMark>(() => ({ kind: this.kind(), key: this.key() }));

  protected isTabStop = computed(() => {
    const stop = this.chart.tabStopMark();

    return stop?.kind === this.kind() && stop.key === this.key();
  });

  constructor() {
    const unregister = this.chart.registerMark({
      element: injectHostElement<HTMLElement | SVGElement>(),
      mark: this.mark,
    });

    inject(DestroyRef).onDestroy(unregister);
  }
}

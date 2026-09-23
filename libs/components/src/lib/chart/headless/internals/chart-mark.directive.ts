import { Directive, inject } from '@angular/core';
import { TooltipDirective } from '../../../tooltip/headless/tooltip.directive';

@Directive({
  selector: '[etChartMark]',
  hostDirectives: [
    {
      directive: TooltipDirective,
      inputs: [
        'etTooltip: etChartMark',
        'etTooltipAriaDescription: etChartMarkDescription',
        'anchor: etChartMarkAnchor',
        'placement: etChartMarkPlacement',
      ],
    },
  ],
  host: {
    tabindex: '0',
    role: 'img',
    '(click)': 'tooltip.show()',
  },
})
export class ChartMarkDirective {
  protected tooltip = inject(TooltipDirective);
}

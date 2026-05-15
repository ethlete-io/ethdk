import { ChangeDetectionStrategy, Component, TemplateRef, ViewEncapsulation, input, viewChild } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { TOOLTIP_IMPORTS } from '../../tooltip.imports';

@Component({
  selector: 'et-sb-tooltip',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans" style="min-height: 18rem;">
      <div class="flex flex-wrap items-center gap-4">
        <button [etTooltip]="tooltipText()" [placement]="placement()" et-button size="sm" variant="outline">
          Text tooltip
        </button>

        <button
          [etTooltip]="templateTooltip()"
          [etTooltipAriaDescription]="templateTooltipAriaDescription()"
          [placement]="placement()"
          et-button
          size="sm"
          variant="tonal"
        >
          Template tooltip
        </button>

        <button
          [etTooltip]="tooltipText()"
          [placement]="placement()"
          [etTooltipDisabled]="disabled()"
          et-button
          size="sm"
        >
          Disabled tooltip
        </button>
      </div>

      <div class="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12">
        <button [etTooltip]="tooltipText()" [placement]="placement()" et-button size="sm" variant="transparent">
          Center target
        </button>
      </div>

      <ng-template #tooltipTemplateRef>
        <div class="flex max-w-xs flex-col gap-1">
          <strong class="text-xs font-semibold uppercase tracking-widest">Tooltip</strong>
          <span>Templated content works too, so richer help and compact metadata are possible.</span>
        </div>
      </ng-template>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BUTTON_IMPORTS, TOOLTIP_IMPORTS],
})
export class TooltipStorybookComponent {
  placement = input<'top' | 'right' | 'bottom' | 'left'>('top');
  disabled = input(false);
  protected tooltipText = input('A lightweight tooltip built on the new overlay primitives.');
  protected templateTooltipAriaDescription = input(
    'Tooltip. Templated content works too, so richer help and compact metadata are possible.',
  );

  protected templateTooltip = viewChild.required<TemplateRef<unknown>>('tooltipTemplateRef');
}

import { Component, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, TOOLTIP_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-tooltip-default-example',
  template: `
    <div class="app-example-row">
      <button etTooltip="A lightweight tooltip anchored to its trigger." et-button size="sm" variant="outline">
        Text tooltip
      </button>

      <button
        [etTooltip]="templateTooltip()"
        etTooltipAriaDescription="Tooltip. Templated content works too."
        et-button
        size="sm"
        variant="tonal"
      >
        Template tooltip
      </button>

      <button etTooltipDisabled etTooltip="Never shown" et-button size="sm">Disabled tooltip</button>

      <button etTooltip="Shown below" placement="bottom" et-button size="sm" variant="transparent">
        Bottom placement
      </button>
    </div>

    <ng-template #tooltipTemplateRef>
      <strong>Tooltip</strong>
      <span>Templated content works too, so richer help and compact metadata are possible.</span>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, TOOLTIP_IMPORTS],
})
export class TooltipDefaultExampleComponent {
  protected templateTooltip = viewChild.required<TemplateRef<unknown>>('tooltipTemplateRef');
}

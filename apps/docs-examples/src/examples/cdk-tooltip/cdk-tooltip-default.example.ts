import { Component, ViewEncapsulation } from '@angular/core';
import { TooltipImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-tooltip-default-example',
  template: `
    <p etTooltip="I am the tooltip">I have a tooltip</p>

    <p [etTooltip]="tooltipTpl" tooltipAriaDescription="Ranked by total points">I have a tooltip template</p>

    <ng-template #tooltipTpl>
      <strong>Fancy template!</strong> Lorem ipsum dolor sit amet consectetur adipisicing elit.
    </ng-template>

    <button etTooltip="I am the tooltip" placement="top" type="button">I have a tooltip on focus too</button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TooltipImports],
})
export class CdkTooltipDefaultExampleComponent {}

import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { Placement } from '@floating-ui/dom';
import { TooltipDirective } from '../../directives/tooltip';

@Component({
  selector: 'et-sb-pagination',
  template: `
    <div class="scroll-container">
      <div>
        <p [placement]="placement" class="tooltip-trigger" etTooltip="I am the tooltip">I have a tooltip</p>
      </div>

      <div>
        <p
          [etTooltip]="tooltipTpl"
          [placement]="placement"
          class="tooltip-trigger"
          tooltipAriaDescription="Fancy template"
        >
          I have a tooltip template
        </p>
      </div>
      <ng-template #tooltipTpl>
        <p class="fancy">
          <strong>Fancy template!</strong> Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum, ipsam.
        </p>
      </ng-template>

      <div>
        <button [placement]="placement" class="tooltip-trigger" type="button" etTooltip="I am the tooltip">
          I have a tooltip even with focus
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .tooltip-trigger {
        display: inline-block;
      }

      .scroll-container {
        height: 200vh;
        width: 200vw;
        padding-left: 50px;
      }

      .fancy {
        margin: 0;
      }
    `,
  ],
  imports: [TooltipDirective, OverlayModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TooltipStorybookComponent {
  placement: Placement = 'bottom';
}

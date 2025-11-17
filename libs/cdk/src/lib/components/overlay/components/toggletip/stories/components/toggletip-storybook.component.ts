import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, viewChild, ViewEncapsulation } from '@angular/core';
import { AnimatedOverlayDirective } from '@ethlete/core';
import { Placement } from '@floating-ui/dom';
import { ToggletipDirective } from '../../directives/toggletip';
import { ToggletipCloseDirective } from '../../partials/toggletip-close';

@Component({
  selector: 'et-sb-toggletip',
  template: `
    <div class="scroll-container">
      <div>
        <button
          [showToggletip]="showTooltip"
          [placement]="placement"
          (click)="showTooltip = !showTooltip"
          (toggletipClose)="showTooltip = false"
          class="toggletip-trigger"
          type="button"
          etToggletip="I am the toggletip"
        >
          I have a toggletip simple
        </button>
      </div>
      <br /><br /><br /><br />

      <p>State: {{ anim()?.state() }}</p>

      <br /><br /><br /><br />

      <div>
        <button
          [showToggletip]="showTooltip2"
          [etToggletip]="toggletipTpl"
          [placement]="placement"
          (click)="showTooltip2 = !showTooltip2"
          (toggletipClose)="showTooltip2 = false"
          class="toggletip-trigger"
          type="button"
        >
          I have a toggletip with template
        </button>

        <ng-template #toggletipTpl>
          <p class="fancy">
            <strong>Fancy template!</strong> Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum, ipsam.
          </p>

          <button etToggletipClose type="button">Close</button>
        </ng-template>
      </div>
    </div>
  `,
  styles: [
    `
      .toggletip-trigger {
        display: inline-block;
      }

      .scroll-container {
        height: 200vh;
        width: 200vw;
        padding-left: 50px;
        padding-top: 50px;
      }

      .fancy {
        margin: 0;
        padding-bottom: 10px;
      }
    `,
  ],
  imports: [ToggletipDirective, OverlayModule, ToggletipCloseDirective],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggletipStorybookComponent {
  showTooltip = true;
  showTooltip2 = false;

  placement: Placement = 'top';

  anim = viewChild(AnimatedOverlayDirective);

  set showToggletip(value: boolean) {
    this.showTooltip = value;
    this.showTooltip2 = value;
  }
}

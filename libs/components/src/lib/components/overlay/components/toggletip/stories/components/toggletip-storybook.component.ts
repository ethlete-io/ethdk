import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ToggletipDirective } from '../../directives';

@Component({
  selector: 'et-sb-pagination',
  template: `
    <div class="scroll-container">
      <div>
        <p class="toggletip-trigger" etToggletip="I am the toggletip">I have a toggletip</p>
      </div>

      <div>
        <p [etToggletip]="toggletipTpl" class="toggletip-trigger" toggletipAriaDescription="Fancy template">
          I have a toggletip template
        </p>
      </div>
      <ng-template #toggletipTpl>
        <p class="fancy">
          <strong>Fancy template!</strong> Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum, ipsam.
        </p>
      </ng-template>

      <div>
        <button class="toggletip-trigger" type="button" etToggletip="I am the toggletip">
          I have a toggletip even with focus
        </button>
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
      }

      .fancy {
        margin: 0;
      }
    `,
  ],
  standalone: true,
  imports: [ToggletipDirective, OverlayModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggletipStorybookComponent {}

import { Component, ViewEncapsulation } from '@angular/core';
import { CollapseDirective } from './headless/collapse.directive';

/**
 * Animates its content between a height of 0 and its natural height. Toggle it with `open`.
 *
 * The clip carries no padding or border of its own - put spacing on the projected content, or it
 * sets a floor under the collapsed height.
 *
 * @example
 * <et-collapse [open]="isOpen()">
 *   <p>Details</p>
 * </et-collapse>
 */
@Component({
  selector: 'et-collapse',
  template: `
    <div class="et-collapse-clip">
      <ng-content />
    </div>
  `,
  styleUrl: './collapse.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: CollapseDirective, inputs: ['open'] }],
  host: {
    class: 'et-collapse',
  },
})
export class CollapseComponent {}

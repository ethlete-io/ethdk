import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ButtonDirective } from '../../directives/button';

@Component({
  selector: '[et-button]',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: ButtonDirective, inputs: ['disabled', 'type', 'pressed'] }],
  host: {
    class: 'et-button et-legacy',
  },
})
export class ButtonComponent {
  protected button = inject(ButtonDirective);
}

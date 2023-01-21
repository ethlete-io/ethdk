import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';
import { CheckboxDirective, CHECKBOX_TOKEN } from '../../directives';

@Component({
  selector: 'et-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-checkbox',
  },
  imports: [NgClass, AsyncPipe],
  hostDirectives: [CheckboxDirective, InputDirective],
})
export class CheckboxComponent {
  protected readonly checkbox = inject(CHECKBOX_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  constructor() {
    this.input._setControlType('et-control--checkbox');
  }
}

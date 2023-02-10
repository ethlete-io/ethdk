import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { InputBase } from '../../../../utils';
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
  imports: [NgClass, AsyncPipe, NativeInputRefDirective],
  hostDirectives: [CheckboxDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class CheckboxComponent extends InputBase {
  protected readonly checkbox = inject(CHECKBOX_TOKEN);
}

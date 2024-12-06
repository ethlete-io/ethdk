import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { InputBase } from '../../../../utils';
import { CHECKBOX_TOKEN, CheckboxDirective } from '../../directives/checkbox';

@Component({
  selector: 'et-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
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

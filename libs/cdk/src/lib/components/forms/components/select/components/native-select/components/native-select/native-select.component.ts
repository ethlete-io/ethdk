import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../../../directives';
import { DecoratedInputBase } from '../../../../../../utils';
import { NATIVE_SELECT_INPUT_TOKEN, NativeSelectInputDirective } from '../../directives';

@Component({
  selector: 'et-native-select',
  templateUrl: './native-select.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-native-select',
  },
  imports: [NativeInputRefDirective, NgTemplateOutlet, AsyncPipe],
  hostDirectives: [NativeSelectInputDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class NativeSelectInputComponent extends DecoratedInputBase {
  protected readonly select = inject(NATIVE_SELECT_INPUT_TOKEN);
}

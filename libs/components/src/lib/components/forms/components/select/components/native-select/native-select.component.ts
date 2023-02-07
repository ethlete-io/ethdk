import { AsyncPipe, NgForOf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { NativeSelectInputDirective as NativeSelectDirective, NATIVE_SELECT_INPUT_TOKEN } from '../../directives';

@Component({
  selector: 'et-native-select',
  templateUrl: './native-select.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-native-select',
  },
  providers: [DestroyService],
  imports: [NativeInputRefDirective, NgForOf, NgTemplateOutlet, AsyncPipe],
  hostDirectives: [NativeSelectDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class NativeSelectInputComponent extends DecoratedInputBase {
  protected readonly select = inject(NATIVE_SELECT_INPUT_TOKEN);
}

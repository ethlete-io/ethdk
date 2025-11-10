import { Directive, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalAttributes } from '@ethlete/core';
import { map } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';
import { CHECKBOX_TOKEN } from '../checkbox';
import { CHECKBOX_GROUP_TOKEN } from '../checkbox-group';

export const CHECKBOX_GROUP_CONTROL_TOKEN = new InjectionToken<CheckboxGroupControlDirective>(
  'ET_CHECKBOX_GROUP_CONTROL_TOKEN',
);

@Directive({
  selector: '[etCheckboxGroupControl]',

  exportAs: 'etCheckboxGroupControl',
  providers: [{ provide: CHECKBOX_GROUP_CONTROL_TOKEN, useExisting: CheckboxGroupControlDirective }],
})
export class CheckboxGroupControlDirective {
  readonly checkbox = inject(CHECKBOX_TOKEN);
  readonly input = inject<InputDirective<boolean>>(INPUT_TOKEN);
  readonly group = inject(CHECKBOX_GROUP_TOKEN);

  readonly inputAttributeBindings = signalAttributes(this.input.nativeInputRef$.pipe(map((el) => el?.element)), {
    'aria-controls': toSignal(
      this.group.checkboxesWithoutGroupCtrl$.pipe(
        map((checkboxes) => checkboxes.map((checkbox) => checkbox.input.id).join(' ')),
      ),
    ),
  });
}

import { AfterContentInit, Directive, inject, InjectionToken } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { map, of } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives';
import { CHECKBOX_TOKEN } from '../checkbox';
import { CHECKBOX_GROUP_TOKEN } from '../checkbox-group';

export const CHECKBOX_GROUP_CONTROL_TOKEN = new InjectionToken<CheckboxGroupControlDirective>(
  'ET_CHECKBOX_GROUP_CONTROL_TOKEN',
);

@Directive({
  selector: '[etCheckboxGroupControl]',
  standalone: true,
  exportAs: 'etCheckboxGroupControl',
  providers: [{ provide: CHECKBOX_GROUP_CONTROL_TOKEN, useExisting: CheckboxGroupControlDirective }],
})
export class CheckboxGroupControlDirective implements AfterContentInit {
  readonly checkbox = inject(CHECKBOX_TOKEN);
  readonly input = inject<InputDirective<boolean>>(INPUT_TOKEN);
  readonly group = inject(CHECKBOX_GROUP_TOKEN);

  readonly _bindings = createReactiveBindings();

  ngAfterContentInit(): void {
    this._bindings.push({
      attribute: ['aria-controls'],
      elementRef: this.input.nativeInputRef?.element,
      observable:
        this.group.checkboxesWithoutGroupCtrl$.pipe(
          map((checkboxes) => ({
            render: true,
            value: checkboxes.map((checkbox) => checkbox.input.id).join(' '),
          })),
        ) ?? of(false),
    });
  }
}

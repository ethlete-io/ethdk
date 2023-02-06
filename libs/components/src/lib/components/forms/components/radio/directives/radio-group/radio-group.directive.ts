import { Directive, inject, InjectionToken } from '@angular/core';
import { createReactiveBindings, DestroyService } from '@ethlete/core';
import { map } from 'rxjs';
import { FormGroupStateService } from '../../../../services';

export const RADIO_GROUP_TOKEN = new InjectionToken<RadioGroupDirective>('ET_RADIO_GROUP_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_GROUP_TOKEN, useExisting: RadioGroupDirective }, DestroyService],
  exportAs: 'etRadioGroup',
  host: {
    role: 'radiogroup',
  },
})
export class RadioGroupDirective {
  private readonly _formGroupStateService = inject(FormGroupStateService);

  readonly name = `et-radio-group-${++nextUniqueId}`;

  readonly _bindings = createReactiveBindings({
    attribute: 'aria-labelledby',
    observable: this._formGroupStateService.describedBy$.pipe(
      map((describedBy) => {
        return {
          render: !!describedBy,
          value: `${describedBy}`,
        };
      }),
    ),
  });
}

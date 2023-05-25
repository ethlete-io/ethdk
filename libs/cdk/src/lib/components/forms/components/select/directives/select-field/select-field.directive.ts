import { Directive, InjectionToken } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';

export const SELECT_FIELD_TOKEN = new InjectionToken<SelectFieldDirective>('ET_SELECT_FIELD_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: SELECT_FIELD_TOKEN, useExisting: SelectFieldDirective }],
  exportAs: 'etSelectField',
})
export class SelectFieldDirective {
  readonly _bindings = createReactiveBindings();
}

import { Directive, InjectionToken } from '@angular/core';
import { FormGroupStateService } from '../../services';

export const STATIC_FORM_GROUP_TOKEN = new InjectionToken<StaticFormGroupDirective>(
  'ET_STATIC_FORM_GROUP_DIRECTIVE_TOKEN',
);

@Directive({
  exportAs: 'etStaticFormGroup',
  providers: [
    FormGroupStateService,
    {
      provide: STATIC_FORM_GROUP_TOKEN,
      useExisting: StaticFormGroupDirective,
    },
  ],
})
export class StaticFormGroupDirective {}

import { AfterContentInit, ContentChildren, Directive, inject, InjectionToken } from '@angular/core';
import { DestroyService, TypedQueryList } from '@ethlete/core';
import { startWith, takeUntil, tap } from 'rxjs';
import { LabelComponent, LABEL_TOKEN } from '../../components';
import { FormFieldStateService } from '../../services';
import { InputDirective, INPUT_TOKEN } from '../input';

export const STATIC_FORM_FIELD_TOKEN = new InjectionToken<StaticFormFieldDirective>(
  'ET_STATIC_FORM_FIELD_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  exportAs: 'etStaticFormField',
  providers: [
    FormFieldStateService,
    {
      provide: STATIC_FORM_FIELD_TOKEN,
      useExisting: StaticFormFieldDirective,
    },
  ],
})
export class StaticFormFieldDirective implements AfterContentInit {
  private readonly _formFieldStateService = inject(FormFieldStateService);
  private readonly _destroy$ = inject(DestroyService).destroy$;

  @ContentChildren(INPUT_TOKEN)
  private readonly _input?: TypedQueryList<InputDirective>;

  @ContentChildren(LABEL_TOKEN)
  private readonly _label?: TypedQueryList<LabelComponent>;

  ngAfterContentInit(): void {
    this._input?.changes
      .pipe(
        startWith(this._input),
        tap((input) => {
          if (input.length > 1) {
            throw new Error('There should be only one input element in the form field.');
          }

          if (input.first) {
            this._formFieldStateService.inputId$.next(input.first.id);
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._label?.changes
      .pipe(
        startWith(this._label),
        tap((label) => {
          if (label.length > 1) {
            throw new Error('There should be only one label element in the form field.');
          }

          if (label.first) {
            this._formFieldStateService.labelId$.next(label.first.id);
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }
}

import { FocusMonitor } from '@angular/cdk/a11y';
import {
  contentChildren,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  InjectionToken,
  untracked,
} from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { takeUntil, tap } from 'rxjs';
import { LABEL_TOKEN } from '../../components/label/components/label';
import { FormFieldStateService } from '../../services';
import { INPUT_TOKEN } from '../input';

export const STATIC_FORM_FIELD_TOKEN = new InjectionToken<StaticFormFieldDirective>(
  'ET_STATIC_FORM_FIELD_DIRECTIVE_TOKEN',
);

@Directive({
  exportAs: 'etStaticFormField',
  providers: [
    FormFieldStateService,
    {
      provide: STATIC_FORM_FIELD_TOKEN,
      useExisting: StaticFormFieldDirective,
    },
  ],
})
export class StaticFormFieldDirective {
  private readonly _formFieldStateService = inject(FormFieldStateService);
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _focusMonitor = inject(FocusMonitor);

  private readonly _input = contentChildren(forwardRef(() => INPUT_TOKEN));
  private readonly _label = contentChildren(forwardRef(() => LABEL_TOKEN));

  constructor() {
    this._focusMonitor
      .monitor(this._elementRef, true)
      .pipe(
        tap((origin) => {
          this._formFieldStateService.isFocusedVia$.next(origin);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    effect(() => {
      const input = this._input();
      const firstInput = input[0] ?? null;

      untracked(() => {
        if (input.length > 1) {
          throw new Error('There should be only one input element in the form field.');
        }

        if (firstInput) {
          this._formFieldStateService.inputId$.next(firstInput.id);
        }
      });
    });

    effect(() => {
      const label = this._label();
      const firstLabel = label[0] ?? null;

      if (label.length > 1) {
        throw new Error('There should be only one label element in the form field.');
      }

      untracked(() => {
        if (firstLabel) {
          this._formFieldStateService.labelId$.next(firstLabel.id);
        }
      });
    });
  }
}

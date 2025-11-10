import { FocusMonitor } from '@angular/cdk/a11y';
import {
  AfterContentInit,
  ContentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  InjectionToken,
  OnInit,
} from '@angular/core';
import { createDestroy, TypedQueryList } from '@ethlete/core';
import { startWith, takeUntil, tap } from 'rxjs';
import { LABEL_TOKEN, LabelComponent } from '../../components/label/components/label';
import { FormFieldStateService } from '../../services';
import { INPUT_TOKEN, InputDirective } from '../input';

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
export class StaticFormFieldDirective implements OnInit, AfterContentInit {
  private readonly _formFieldStateService = inject(FormFieldStateService);
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _focusMonitor = inject(FocusMonitor);

  @ContentChildren(forwardRef(() => INPUT_TOKEN))
  private readonly _input?: TypedQueryList<InputDirective>;

  @ContentChildren(forwardRef(() => LABEL_TOKEN))
  private readonly _label?: TypedQueryList<LabelComponent>;

  ngOnInit(): void {
    this._focusMonitor
      .monitor(this._elementRef, true)
      .pipe(
        tap((origin) => {
          this._formFieldStateService.isFocusedVia$.next(origin);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

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

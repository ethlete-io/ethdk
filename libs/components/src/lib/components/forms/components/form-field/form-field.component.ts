import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  forwardRef,
  inject,
  InjectionToken,
  ViewEncapsulation,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { createReactiveBindings, DestroyService, TypedQueryList } from '@ethlete/core';
import { map, startWith, takeUntil, tap } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../directives';
import { InputStateService, InputTouchedFn, InputValueChangeFn } from '../../services';
import { LabelComponent, LABEL_TOKEN } from '../public-api';

export const FORM_FIELD_TOKEN = new InjectionToken<FormFieldComponent>('ET_FORM_FIELD_COMPONENT_TOKEN');

export const FORM_FIELD_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => FormFieldComponent),
  multi: true,
};

@Component({
  selector: 'et-form-field',
  templateUrl: './form-field.component.html',
  styleUrls: ['./form-field.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field',
  },
  providers: [
    FORM_FIELD_VALUE_ACCESSOR,
    { provide: FORM_FIELD_TOKEN, useExisting: FormFieldComponent },
    DestroyService,
    InputStateService,
  ],
})
export class FormFieldComponent implements AfterContentInit, ControlValueAccessor {
  private readonly _inputStateService = inject(InputStateService);
  private readonly _destroy$ = inject(DestroyService).destroy$;

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-required',
      observable: this._inputStateService.required$,
    },
    {
      attribute: 'class.et-disabled',
      observable: this._inputStateService.disabled$,
    },
    {
      attribute: 'class',
      observable: this._inputStateService.controlType$.pipe(map((type) => ({ render: !!type, value: `${type}` }))),
    },
  );

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
            this._inputStateService.inputId$.next(input.first.id);
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
            this._inputStateService.labelId$.next(label.first.id);
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  writeValue(value: unknown) {
    this._inputStateService.value$.next(value);
  }

  registerOnChange(fn: InputValueChangeFn) {
    this._inputStateService._valueChange = fn;
  }

  registerOnTouched(fn: InputTouchedFn) {
    this._inputStateService._touched = fn;
  }

  setDisabledState?(isDisabled: boolean) {
    this._inputStateService.disabled$.next(isDisabled);
  }
}

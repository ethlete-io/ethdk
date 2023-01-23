import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  inject,
  InjectionToken,
  ViewEncapsulation,
} from '@angular/core';
import { createReactiveBindings, DestroyService, TypedQueryList } from '@ethlete/core';
import { map, startWith, takeUntil, tap } from 'rxjs';
import { FormControlHostDirective, InputDirective, INPUT_TOKEN } from '../../directives';
import { FormFieldStateService } from '../../services';
import { LabelComponent, LABEL_TOKEN } from '../label';

export const FORM_FIELD_TOKEN = new InjectionToken<FormFieldComponent>('ET_FORM_FIELD_COMPONENT_TOKEN');

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
  providers: [DestroyService, FormFieldStateService, { provide: FORM_FIELD_TOKEN, useExisting: FormFieldComponent }],
  hostDirectives: [FormControlHostDirective],
})
export class FormFieldComponent implements AfterContentInit {
  private readonly _formFieldStateService = inject(FormFieldStateService);
  private readonly _destroy$ = inject(DestroyService).destroy$;

  readonly _bindings = createReactiveBindings({
    attribute: 'class',
    observable: this._formFieldStateService.controlType$.pipe(map((type) => ({ render: !!type, value: `${type}` }))),
  });

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

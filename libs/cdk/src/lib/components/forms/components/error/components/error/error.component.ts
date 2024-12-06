import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ValidationErrors } from '@angular/forms';
import { signalHostClasses } from '@ethlete/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { DYNAMIC_FORM_FIELD_TOKEN } from '../../../../directives/dynamic-form-field';
import { DYNAMIC_FORM_GROUP_TOKEN } from '../../../../directives/dynamic-form-group';
import { FormFieldStateService, FormGroupStateService, VALIDATOR_ERROR_SERVICE_TOKEN } from '../../../../services';

let _uniqueIdCounter = 0;

@Component({
  selector: 'et-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-error',
  },
  imports: [AsyncPipe],
})
export class ErrorComponent {
  private readonly _validatorErrorsService = inject(VALIDATOR_ERROR_SERVICE_TOKEN);
  private readonly _formFieldOrGroupStateService =
    inject(FormFieldStateService, { optional: true }) ?? inject(FormGroupStateService);

  private readonly _dynamicFormGroupOrField =
    inject(DYNAMIC_FORM_FIELD_TOKEN, { optional: true }) ?? inject(DYNAMIC_FORM_GROUP_TOKEN);

  protected readonly errorText$ = new BehaviorSubject<Observable<string> | null>(null);

  readonly id = `et-error-${_uniqueIdCounter++}`;

  @Input()
  public get errors() {
    return this._errors;
  }
  public set errors(v: ValidationErrors | null) {
    this._errors = v;

    if (v) {
      const errorText = this._validatorErrorsService.parse(v);

      if (typeof errorText === 'string') {
        this.errorText$.next(of(errorText));
      } else {
        this.errorText$.next(errorText);
      }

      this._formFieldOrGroupStateService.errorId$.next(this.id);
    } else {
      this.errorText$.next(null);
      this._formFieldOrGroupStateService.errorId$.next(null);
    }
  }
  private _errors: ValidationErrors | null = null;

  readonly hostClassBindings = signalHostClasses({
    'et-error--has-errors': toSignal(this.errorText$),
    'cdk-visually-hidden': toSignal(this._dynamicFormGroupOrField.hideErrorMessage$),
  });
}

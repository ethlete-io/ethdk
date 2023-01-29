import { AsyncPipe, JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, ViewEncapsulation } from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { VALIDATOR_ERROR_SERVICE_TOKEN } from '../../../../services';

@Component({
  selector: 'et-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-error',
    '[class.et-error--has-errors]': 'errors',
  },
  imports: [JsonPipe, NgIf, AsyncPipe],
  hostDirectives: [],
})
export class ErrorComponent {
  private readonly _validatorErrorsService = inject(VALIDATOR_ERROR_SERVICE_TOKEN);

  protected readonly errorText$ = new BehaviorSubject<Observable<string> | null>(null);

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
    } else {
      this.errorText$.next(null);
    }
  }
  private _errors: ValidationErrors | null = null;
}

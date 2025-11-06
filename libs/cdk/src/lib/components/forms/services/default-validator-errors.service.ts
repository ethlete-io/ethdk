import { Injectable, InjectionToken, isDevMode } from '@angular/core';
import { AT_LEAST_ONE_REQUIRED, IS_ARRAY_NOT_EMPTY, IS_EMAIL, MUST_MATCH } from '@ethlete/core';
import { Observable } from 'rxjs';
import { ValidatorErrors } from '../types';

export const VALIDATOR_ERROR_SERVICE_TOKEN = new InjectionToken<ValidationErrorsServiceType>('VALIDATOR_ERROR_SERVICE');

export interface ValidationErrorsServiceType {
  parse: (errors: ValidatorErrors) => string | Observable<string>;
}

export const provideValidatorErrorsService = (
  service: new () => ValidationErrorsServiceType = DefaultValidatorErrorsService,
) => ({
  provide: VALIDATOR_ERROR_SERVICE_TOKEN,
  useClass: service,
});

@Injectable()
export class DefaultValidatorErrorsService implements ValidationErrorsServiceType {
  parse(errors: ValidatorErrors): string | Observable<string> {
    if (errors.required) {
      return 'This field is required';
    } else if (errors.email || errors[IS_EMAIL]) {
      return 'This field must be a valid email';
    } else if (errors.minlength) {
      return `This field must be at least ${errors.minlength.requiredLength} characters`;
    } else if (errors.maxlength) {
      return `This field must be at most ${errors.maxlength.requiredLength} characters`;
    } else if (errors.pattern) {
      return `This field must match the pattern ${errors.pattern.requiredPattern}`;
    } else if (errors.min) {
      return `This field must be at least ${errors.min.min}`;
    } else if (errors.max) {
      return `This field must be at most ${errors.max.max}`;
    } else if (errors[MUST_MATCH]) {
      return `This field must match`;
    } else if (errors[IS_ARRAY_NOT_EMPTY]) {
      return `This field must not be empty`;
    } else if (errors[AT_LEAST_ONE_REQUIRED]) {
      return `At least one of the fields is required`;
    } else {
      if (isDevMode()) {
        console.warn('Unknown validation error', errors);
      }
    }

    return 'This field is invalid';
  }
}

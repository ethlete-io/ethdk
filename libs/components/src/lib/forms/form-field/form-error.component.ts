import { Component, InjectionToken, Provider, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';

/**
 * Resolves the text shown for a validation error. Return `null` to fall back to the error's own
 * `message`. Lets an app centralize/localize error texts by `kind` (e.g. `required`, `minLength`,
 * or `@ethlete/query`'s `etServerViolation`) instead of putting a `message` on every validator.
 */
export type FormErrorMessageResolver = (error: ValidationError.WithOptionalFieldTree) => string | null;

export const FORM_ERROR_MESSAGE_RESOLVER = new InjectionToken<FormErrorMessageResolver>('FORM_ERROR_MESSAGE_RESOLVER');

export const provideFormErrorMessageResolver = (resolver: FormErrorMessageResolver): Provider => ({
  provide: FORM_ERROR_MESSAGE_RESOLVER,
  useValue: resolver,
});

@Component({
  selector: 'et-form-error',
  template: '{{ message() }}',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-error',
  },
})
export class FormErrorComponent {
  private messageResolver = inject(FORM_ERROR_MESSAGE_RESOLVER, { optional: true });

  public error = input.required<ValidationError.WithOptionalFieldTree>();

  protected message = computed(() => this.messageResolver?.(this.error()) ?? this.error().message ?? '');
}

import { Component, InjectionToken, Provider, ViewEncapsulation, computed, effect, inject, input } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FormFieldLabels, injectFormFieldLabels } from './form-field-labels';

/**
 * Resolves the text shown for a validation error. Return `null` to fall back to the error's own
 * `message`, then to the built-in default text for its `kind` (see `FORM_FIELD_LABELS`). Lets an app centralize/localize error texts by `kind` (e.g. `required`, `minLength`,
 * or `@ethlete/query`'s `etServerViolation`) instead of putting a `message` on every validator.
 */
export type FormErrorMessageResolver = (error: ValidationError.WithOptionalFieldTree) => string | null;

export const FORM_ERROR_MESSAGE_RESOLVER = new InjectionToken<FormErrorMessageResolver>('FORM_ERROR_MESSAGE_RESOLVER');

export const provideFormErrorMessageResolver = (resolver: FormErrorMessageResolver): Provider => ({
  provide: FORM_ERROR_MESSAGE_RESOLVER,
  useValue: resolver,
});

const defaultMessage = (labels: FormFieldLabels, error: ValidationError.WithOptionalFieldTree): string | undefined => {
  switch (error.kind) {
    case 'required':
      return labels.errorRequired;
    case 'min':
      return labels.errorMin(error as unknown as { min: number });
    case 'max':
      return labels.errorMax(error as unknown as { max: number });
    case 'minLength':
      return labels.errorMinLength(error as unknown as { minLength: number });
    case 'maxLength':
      return labels.errorMaxLength(error as unknown as { maxLength: number });
    case 'pattern':
      return labels.errorPattern(error as unknown as { pattern: RegExp });
    case 'email':
      return labels.errorEmail;
    default:
      return undefined;
  }
};

const warnedMessagelessKinds = /* @__PURE__ */ new Set<string>();

const warnMessagelessError = (kind: string) => {
  if (warnedMessagelessKinds.has(kind)) {
    return;
  }

  warnedMessagelessKinds.add(kind);
  console.warn(
    `[FormErrorComponent] The validation error "${kind}" has no message, so the field shows an empty error. ` +
      `Pass { message } to the validator, or map the kind to a text app-wide with provideFormErrorMessageResolver().`,
  );
};

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

  private labels = injectFormFieldLabels();

  public error = input.required<ValidationError.WithOptionalFieldTree>();

  protected message = computed(() => {
    const error = this.error();

    return this.messageResolver?.(error) ?? error.message ?? defaultMessage(this.labels(), error) ?? '';
  });

  constructor() {
    if (ngDevMode) {
      effect(() => {
        if (!this.message()) {
          warnMessagelessError(this.error().kind);
        }
      });
    }
  }
}

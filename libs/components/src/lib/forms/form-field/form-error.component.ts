import { Component, InjectionToken, Provider, ViewEncapsulation, computed, effect, inject, input } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { ServerViolationValidationError } from '@ethlete/query';
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

/** The validator value of each known error `kind`, as `formErrorContext()` and `provideFormErrorMessages()` hand it out. */
export type FormErrorContextMap = {
  required: true | undefined;
  email: true | undefined;
  min: { min: number; actual: number | undefined };
  max: { max: number; actual: number | undefined };
  minLength: { minLength: number };
  maxLength: { maxLength: number };
  minlength: { requiredLength: number; actualLength: number };
  maxlength: { requiredLength: number; actualLength: number };
  pattern: { requiredPattern: string | RegExp; actualValue: string | undefined };
  etServerViolation: ServerViolationValidationError['violation'];
  etServerError: undefined;
};

export type FormErrorContext<TKind extends string> = TKind extends keyof FormErrorContextMap
  ? FormErrorContextMap[TKind]
  : unknown;

/** Reads the validator value of an error, typed by its `kind`; `unknown` for a kind outside `FormErrorContextMap`. */
export const formErrorContext = <const TKind extends string>(
  error: ValidationError.WithOptionalFieldTree,
  kind: TKind,
): FormErrorContext<TKind> | undefined => {
  if (error.kind !== kind) {
    return undefined;
  }

  const raw = error as unknown as Record<string, unknown>;
  const context = (raw['context'] ?? {}) as Record<string, unknown>;

  switch (kind as string) {
    case 'min':
      return { min: context['min'] ?? raw['min'], actual: context['actual'] } as FormErrorContext<TKind>;
    case 'max':
      return { max: context['max'] ?? raw['max'], actual: context['actual'] } as FormErrorContext<TKind>;
    case 'minLength':
      return { minLength: raw['minLength'] } as FormErrorContext<TKind>;
    case 'maxLength':
      return { maxLength: raw['maxLength'] } as FormErrorContext<TKind>;
    case 'pattern':
      return {
        requiredPattern: context['requiredPattern'] ?? raw['pattern'],
        actualValue: context['actualValue'],
      } as FormErrorContext<TKind>;
    case 'etServerViolation':
      return raw['violation'] as FormErrorContext<TKind>;
    case 'etServerError':
      return undefined;
    default:
      return raw['context'] as FormErrorContext<TKind>;
  }
};

export type FormErrorMessages = {
  [TKind in keyof FormErrorContextMap]?: (
    context: FormErrorContextMap[TKind],
    error: ValidationError.WithOptionalFieldTree,
  ) => string | null;
} & {
  otherwise?: (error: ValidationError.WithOptionalFieldTree) => string | null;
};

/** Provides a resolver from a map of texts per error `kind`; each function receives the validator value typed for its kind, `null` falls back to the default text. */
export const provideFormErrorMessages = (messages: FormErrorMessages): Provider =>
  provideFormErrorMessageResolver((error) => {
    const resolve = (messages as Record<string, ((context: unknown, error: unknown) => string | null) | undefined>)[
      error.kind
    ];

    if (resolve && error.kind !== 'otherwise') {
      return resolve(formErrorContext(error, error.kind), error);
    }

    return messages.otherwise?.(error) ?? null;
  });

const reactiveBound = (error: ValidationError.WithOptionalFieldTree, key: string) =>
  (error as unknown as { context?: Record<string, number> }).context?.[key];

const defaultMessage = (labels: FormFieldLabels, error: ValidationError.WithOptionalFieldTree): string | undefined => {
  switch (error.kind) {
    case 'required':
      return labels.errorRequired;
    case 'min':
      return labels.errorMin({ min: reactiveBound(error, 'min') ?? (error as unknown as { min: number }).min });
    case 'max':
      return labels.errorMax({ max: reactiveBound(error, 'max') ?? (error as unknown as { max: number }).max });
    case 'minLength':
      return labels.errorMinLength(error as unknown as { minLength: number });
    case 'minlength':
      return labels.errorMinLength({ minLength: reactiveBound(error, 'requiredLength') as number });
    case 'maxLength':
      return labels.errorMaxLength(error as unknown as { maxLength: number });
    case 'maxlength':
      return labels.errorMaxLength({ maxLength: reactiveBound(error, 'requiredLength') as number });
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
    `[FormErrorComponent] The validation error "${kind}" has no message, so the field shows the generic fallback text. ` +
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

  private specificMessage = computed(() => {
    const error = this.error();

    return this.messageResolver?.(error) ?? error.message ?? defaultMessage(this.labels(), error) ?? null;
  });

  protected message = computed(() => {
    return this.specificMessage() ?? this.labels().errorFallback;
  });

  constructor() {
    if (ngDevMode) {
      effect(() => {
        if (this.specificMessage() === null) {
          warnMessagelessError(this.error().kind);
        }
      });
    }
  }
}

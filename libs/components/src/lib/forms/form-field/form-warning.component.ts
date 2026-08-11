import { Component, InjectionToken, Provider, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { FieldWarning } from './headless';

/**
 * Resolves the text shown for a field warning. Return `null` to fall back to the warning's own
 * `message`. Lets an app centralize/localize warning texts by `kind` instead of putting a `message`
 * on every `warn()` rule.
 */
export type FormWarningMessageResolver = (warning: FieldWarning) => string | null;

export const FORM_WARNING_MESSAGE_RESOLVER = new InjectionToken<FormWarningMessageResolver>(
  'FORM_WARNING_MESSAGE_RESOLVER',
);

export const provideFormWarningMessageResolver = (resolver: FormWarningMessageResolver): Provider => ({
  provide: FORM_WARNING_MESSAGE_RESOLVER,
  useValue: resolver,
});

@Component({
  selector: 'et-form-warning',
  template: '{{ message() }}',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-warning',
  },
})
export class FormWarningComponent {
  private messageResolver = inject(FORM_WARNING_MESSAGE_RESOLVER, { optional: true });

  public warning = input.required<FieldWarning>();

  protected message = computed(() => this.messageResolver?.(this.warning()) ?? this.warning().message ?? '');
}

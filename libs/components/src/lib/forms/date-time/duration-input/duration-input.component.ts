import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { IconDirective, TIMES_ICON, provideIcons } from '../../../icon';
import { DurationInputDirective, DurationInputFieldDirective } from './headless';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';

@Component({
  selector: 'et-duration-input',
  templateUrl: './duration-input.component.html',
  styleUrl: './duration-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [DurationInputFieldDirective, IconDirective],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [
    {
      directive: DurationInputDirective,
      inputs: [
        'value',
        'mixed',
        'mixedLabel',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'placeholder',
        'parseErrorMessage',
        'durationFormat',
        'aria-label',
        'aria-labelledby',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-duration-input',
    '(click)': 'durationInput.activate()',
  },
})
export class DurationInputComponent {
  private formFieldLabels = injectFormFieldLabels();

  protected durationInput = inject(DurationInputDirective);

  /** Shows a clear (×) control while a value or pending text is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  // only while the field is in use - mirrors the select's clear affordance
  protected showClear = computed(
    () =>
      this.clearable() &&
      this.durationInput.hasValue() &&
      this.durationInput.focused() &&
      !this.durationInput.disabled() &&
      !this.durationInput.readonly(),
  );

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the host's activate-on-click handling
    event.stopPropagation();
    this.durationInput.clearValue();
  }

  public focus(options?: FocusOptions) {
    this.durationInput.focus(options);
  }
}

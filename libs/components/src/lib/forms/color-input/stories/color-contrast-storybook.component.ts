import { Component, computed, input, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { CHOICE_FIELD_IMPORTS } from '../../choice-field';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { SWITCH_IMPORTS } from '../../switch';
import { colorContrast, getColorContrastRatio, WCAG_CONTRAST_RATIOS } from '../color-input-validators';
import { COLOR_INPUT_IMPORTS } from '../color-input.imports';

@Component({
  selector: 'et-sb-form-field-color-contrast',
  template: `
    <div [etProvideColor]="color()" [style.max-inline-size.px]="480" class="flex flex-col gap-8 p-8 font-sans">
      <et-form-field>
        <et-label>Background</et-label>
        <et-color-input [formField]="themeForm.background" />
      </et-form-field>

      <et-form-field>
        <et-label>Text color</et-label>
        <et-color-input [formField]="themeForm.text" />
        <et-hint>Needs {{ textMinimum() }}:1 against the background.</et-hint>
      </et-form-field>

      <et-choice-field>
        <et-switch [formField]="themeForm.largeText" />
        <et-label>Large text (18.66px, or 24px bold)</et-label>
      </et-choice-field>

      <et-form-field>
        <et-label>Accent</et-label>
        <et-color-input [formField]="themeForm.accent" />
        <et-hint>Icons and borders only need {{ ACCENT_MINIMUM }}:1 - and it only warns.</et-hint>
      </et-form-field>

      <div
        [style.background]="themeForm.background().value()"
        [style.color]="themeForm.text().value()"
        class="flex flex-col gap-2 rounded-lg p-6"
      >
        <p [class]="themeForm.largeText().value() ? 'text-large' : 'text-medium'">
          The quick brown fox jumps over the lazy dog.
        </p>
        <p [style.color]="themeForm.accent().value()" class="text-small">Accented supporting line.</p>
      </div>

      <dl class="text-small grid grid-cols-[auto_1fr] gap-x-4">
        <dt>Text on background</dt>
        <dd>{{ ratio(themeForm.text().value()) }}:1</dd>
        <dt>Accent on background</dt>
        <dd>{{ ratio(themeForm.accent().value()) }}:1</dd>
      </dl>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...COLOR_INPUT_IMPORTS,
    ...CHOICE_FIELD_IMPORTS,
    ...SWITCH_IMPORTS,
    FormField,
    ProvideColorDirective,
  ],
})
export class FormFieldColorContrastStorybookComponent {
  public color = input('brand');

  protected readonly ACCENT_MINIMUM = WCAG_CONTRAST_RATIOS.nonText;

  private model = signal({ background: '#ffffff', text: '#8a8a8a', accent: '#c7d5e8', largeText: false });

  public themeForm = form(this.model, (s) => {
    colorContrast(s.text, {
      against: s.background,
      min: ({ valueOf }) => (valueOf(s.largeText) ? WCAG_CONTRAST_RATIOS.aaLarge : WCAG_CONTRAST_RATIOS.aaNormal),
    });

    colorContrast(s.accent, { against: s.background, min: WCAG_CONTRAST_RATIOS.nonText, severity: 'warning' });
  });

  protected textMinimum = computed(() =>
    this.themeForm.largeText().value() ? WCAG_CONTRAST_RATIOS.aaLarge : WCAG_CONTRAST_RATIOS.aaNormal,
  );

  protected ratio(value: string | null) {
    const measured = getColorContrastRatio(value, this.themeForm.background().value());

    return measured === null ? '-' : (Math.floor(measured * 100) / 100).toFixed(2);
  }
}

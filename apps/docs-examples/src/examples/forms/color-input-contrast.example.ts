import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  CHOICE_FIELD_IMPORTS,
  COLOR_INPUT_IMPORTS,
  colorContrast,
  FORM_FIELD_IMPORTS,
  getColorContrastRatio,
  SWITCH_IMPORTS,
  WCAG_CONTRAST_RATIOS,
} from '@ethlete/components';

@Component({
  selector: 'app-color-input-contrast-example',
  template: `
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

    <div [style.background]="themeForm.background().value()" [style.color]="themeForm.text().value()">
      <p>The quick brown fox jumps over the lazy dog.</p>
      <p [style.color]="themeForm.accent().value()">Accented supporting line.</p>
    </div>

    <dl>
      <dt>Text on background</dt>
      <dd>{{ ratio(themeForm.text().value()) }}:1</dd>
      <dt>Accent on background</dt>
      <dd>{{ ratio(themeForm.accent().value()) }}:1</dd>
    </dl>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, COLOR_INPUT_IMPORTS, CHOICE_FIELD_IMPORTS, SWITCH_IMPORTS, FormField],
})
export class ColorInputContrastExampleComponent {
  protected readonly ACCENT_MINIMUM = WCAG_CONTRAST_RATIOS.nonText;

  private model = signal({ background: '#ffffff', text: '#8a8a8a', accent: '#c7d5e8', largeText: false });

  protected themeForm = form(this.model, (s) => {
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

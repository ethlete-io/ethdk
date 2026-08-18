import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { injectColorInputLabels } from './color-input-labels';
import { ColorPickerPanelComponent } from './color-picker-panel.component';
import { ColorInputDirective, ColorPickerSurfaceDirective, ColorPickerTriggerDirective } from './headless';

@Component({
  selector: 'et-color-input',
  templateUrl: './color-input.component.html',
  styleUrl: './color-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ColorPickerPanelComponent, ColorPickerSurfaceDirective, ColorPickerTriggerDirective],
  hostDirectives: [
    {
      directive: ColorInputDirective,
      inputs: [
        'value',
        'mixed',
        'touched',
        'mixedLabel',
        'disabled',
        'readonly',
        'hidden',
        'invalid',
        'errors',
        'required',
        'name',
        'maxLength',
        'pending',
        'alpha',
        'swatches',
        'notations',
        'pickerOpen',
        'aria-label',
        'aria-labelledby',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'pickerOpenChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-color-input',
    '(click)': 'colorInputDir.activate()',
  },
})
export class ColorInputComponent {
  protected colorInputDir = inject(ColorInputDirective);
  public labels = injectColorInputLabels();

  /** The accessible name of the trigger, unless the consumer supplied one. */
  protected fallbackTriggerLabel = computed(() =>
    this.colorInputDir.hasCustomAccessibleName() || this.colorInputDir.labelId() ? null : this.labels().pickerTrigger,
  );

  public focus(options?: FocusOptions) {
    this.colorInputDir.focus(options);
  }
}

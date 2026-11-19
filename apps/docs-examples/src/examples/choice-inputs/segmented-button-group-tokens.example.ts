import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SEGMENTED_BUTTON_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-segmented-button-group-tokens-example',
  template: `
    <et-segmented-button-group
      [formField]="viewForm.viewMode"
      [style.--et-segmented-button-group-columns]="2"
      [style.--et-segmented-button-font-weight]="700"
      stretch
    >
      <et-label>Status</et-label>
      @for (option of OPTIONS; track option.value) {
        <et-segmented-button [value]="option.value">{{ option.label }}</et-segmented-button>
      }
    </et-segmented-button-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SEGMENTED_BUTTON_IMPORTS, FormField],
})
export class SegmentedButtonGroupTokensExampleComponent {
  protected readonly OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'live', label: 'Live now' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'done', label: 'Done' },
  ];

  private model = signal<{ viewMode: string | null }>({ viewMode: 'all' });

  protected viewForm = form(this.model);
}

import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SEGMENTED_BUTTON_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-segmented-button-group-default-example',
  template: `
    <et-segmented-button-group [formField]="viewForm.viewMode">
      <et-label>View mode</et-label>
      @for (option of OPTIONS; track option.value) {
        <et-segmented-button [value]="option.value">{{ option.label }}</et-segmented-button>
      }
    </et-segmented-button-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SEGMENTED_BUTTON_IMPORTS, FormField],
})
export class SegmentedButtonGroupDefaultExampleComponent {
  protected readonly OPTIONS = [
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
    { value: 'table', label: 'Table' },
  ];

  private model = signal<{ viewMode: string | null }>({ viewMode: 'list' });

  protected viewForm = form(this.model);
}

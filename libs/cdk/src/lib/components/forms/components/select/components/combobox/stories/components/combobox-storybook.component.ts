import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ComboboxImports } from '../../../../..';

@Component({
  selector: 'et-sb-combobox',
  template: `
    <et-select-field [formControl]="fg">
      <et-label>Select</et-label>

      <et-combobox
        [options]="options"
        [bindLabel]="bindLabel"
        [bindValue]="bindValue"
        [multiple]="multiple"
        [initialValue]="initialValue"
        [loading]="loading"
        [error]="error"
        [placeholder]="placeholder"
        [allowCustomValues]="allowCustomValues"
        [filterInternal]="filterInternal"
      />
    </et-select-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ComboboxImports, ReactiveFormsModule, JsonPipe],
})
export class StorybookComboboxComponent {
  fg = new FormControl({ value: null, disabled: false });

  options: unknown[] = [];

  bindLabel: string | null = null;
  bindValue: string | null = null;

  multiple = true;

  initialValue: unknown;

  loading = false;

  error = null;

  placeholder = 'Select an option';

  allowCustomValues = false;

  filterInternal = true;

  set _formValue(value: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fg.setValue(value as any);
  }
}

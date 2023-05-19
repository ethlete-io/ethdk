import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ComboboxImports } from '../../combobox.imports';

@Component({
  selector: 'et-sb-combobox',
  template: `
    <et-select-field [formControl]="fg">
      <et-label>Select</et-label>

      <et-combobox />
    </et-select-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ComboboxImports, ReactiveFormsModule, JsonPipe],
})
export class StorybookComboboxComponent {
  fg = new FormControl({ value: ['1', '3'], disabled: false });
}

import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectImports } from '../../../../..';

@Component({
  selector: 'et-sb-select',
  template: `
    <et-select-field [formControl]="fg">
      <et-label>Select</et-label>

      <et-select [searchable]="searchable">
        <et-select-option value="1">Option 1</et-select-option>
        <et-select-option value="2" disabled>Option 2</et-select-option>
        <et-select-option value="3">Option 3</et-select-option>
      </et-select>
    </et-select-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SelectImports, ReactiveFormsModule, JsonPipe],
})
export class StorybookSelectComponent {
  fg = new FormControl({ value: null, disabled: false });

  searchable = false;
}

import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectImports } from '../../select.imports';

@Component({
  selector: 'et-sb-select',
  template: `
    <et-select-field [formControl]="fg">
      <et-label>Select</et-label>

      <et-select [emptyText]="emptyText" [multiple]="multiple">
        <et-select-option value="1">Option 1</et-select-option>
        <et-select-option value="2">Option 2</et-select-option>
        <et-select-option value="3">Option 3</et-select-option>
        <et-select-option value="4" disabled>Option 4 (disabled)</et-select-option>
        <et-select-option value="5">Option 5</et-select-option>
      </et-select>
    </et-select-field>

    <pre> {{ fg.value | json }} </pre>

    <button (click)="fg.setValue(null)">Clear</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SelectImports, ReactiveFormsModule, JsonPipe],
})
export class StorybookSelectComponent {
  fg = new FormControl({ value: ['1', '3'], disabled: false });

  emptyText?: string;

  multiple = true;
}

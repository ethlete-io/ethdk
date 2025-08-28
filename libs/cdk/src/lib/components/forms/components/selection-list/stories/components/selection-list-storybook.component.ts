import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectionListImports } from '../../selection-list.imports';

@Component({
  selector: 'et-sb-selection-list',
  template: `
    <et-selection-list-field [formControl]="fg" [multiple]="multiple" class="et-sb-selection-list-example">
      <et-selection-list-option isResetOption>Reset</et-selection-list-option>
      <et-selection-list-option [value]="'1'">Option 1</et-selection-list-option>
      <et-selection-list-option [value]="'2'">Item 2</et-selection-list-option>
      <et-selection-list-option [value]="'3'">Select me 3</et-selection-list-option>
      <et-selection-list-option [value]="'4'" disabled>I am disabled</et-selection-list-option>
    </et-selection-list-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  styles: [
    `
      .et-sb-selection-list-example {
        display: grid;
        gap: 8px;

        .et-selection-list-option--disabled {
          color: #ccc;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SelectionListImports, ReactiveFormsModule, JsonPipe],
})
export class StorybookSelectionListComponent {
  fg = new FormControl({ value: '3', disabled: false });

  multiple = false;
}

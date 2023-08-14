import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectionListImports } from '../../..';

@Component({
  selector: 'et-sb-selection-list',
  template: `
    <et-selection-list-field [formControl]="fg" multiple>
      <et-selection-list-option [value]="'1'">Option 1</et-selection-list-option>
      <et-selection-list-option [value]="'2'">Option 2</et-selection-list-option>
      <et-selection-list-option [value]="'3'">Option 3</et-selection-list-option>
    </et-selection-list-field>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [SelectionListImports, ReactiveFormsModule],
})
export class StorybookSelectionListComponent {
  fg = new FormControl('1');
}

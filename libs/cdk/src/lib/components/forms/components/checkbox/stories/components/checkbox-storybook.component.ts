import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CheckboxImports } from '../../checkbox.imports';

@Component({
  selector: 'et-sb-checkbox',
  template: `
    <et-checkbox-group>
      <et-checkbox-field>
        <et-checkbox etCheckboxGroupControl />
        <et-label>All</et-label>
      </et-checkbox-field>

      <et-checkbox-field [formControl]="fg">
        <et-checkbox />
        <et-label>Apple</et-label>
      </et-checkbox-field>

      <et-checkbox-field [formControl]="fg2">
        <et-checkbox />
        <et-label>Bananas</et-label>
      </et-checkbox-field>

      <et-checkbox-field [formControl]="fg3">
        <et-checkbox />
        <et-label>Pineapples</et-label>
      </et-checkbox-field>
    </et-checkbox-group>

    <br /><br />

    <et-checkbox-card-field [formControl]="fg4">
      <et-label>Pineapples in a field</et-label>
      <et-checkbox />
    </et-checkbox-card-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [CheckboxImports, ReactiveFormsModule],
})
export class StorybookCheckboxComponent {
  fg = new FormControl(false);
  fg2 = new FormControl(false);
  fg3 = new FormControl(false);
  fg4 = new FormControl(false);
}

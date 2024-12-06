import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-search-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-search-input>
        <et-search-input-clear *etIfInputFilled etInputSuffix>clear</et-search-input-clear>
      </et-search-input>
      <et-label>Search input</et-label>
    </et-input-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookSearchInputComponent {
  fg = new FormControl();
}

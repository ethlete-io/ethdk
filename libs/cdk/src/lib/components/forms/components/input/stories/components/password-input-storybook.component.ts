import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-password-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-password-input>
        <et-password-input-toggle etInputSuffix>show</et-password-input-toggle>
      </et-password-input>
      <et-label>Password input</et-label>
    </et-input-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookPasswordInputComponent {
  fg = new FormControl();
}

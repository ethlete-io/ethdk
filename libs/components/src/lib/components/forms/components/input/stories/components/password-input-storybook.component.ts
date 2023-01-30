import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports, LabelComponent } from '../../..';

@Component({
  selector: 'et-sb-password-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-password-input>
        <et-password-input-toggle>show</et-password-input-toggle>
      </et-password-input>
      <et-label>Password input</et-label>
    </et-input-field>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, LabelComponent, ReactiveFormsModule],
})
export class StorybookPasswordInputComponent {
  fg = new FormControl();
}

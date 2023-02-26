import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports, LabelComponent } from '../../..';

@Component({
  selector: 'et-sb-text-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-text-input />
      <et-label>Text input</et-label>
    </et-input-field>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, LabelComponent, ReactiveFormsModule],
})
export class StorybookTextInputComponent {
  fg = new FormControl();
}

import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports, LabelComponent } from '../../..';

@Component({
  selector: 'et-sb-textarea-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-textarea-input />
      <et-label>Textarea input</et-label>
    </et-input-field>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, LabelComponent, ReactiveFormsModule],
})
export class StorybookTextareaInputComponent {
  fg = new FormControl();
}

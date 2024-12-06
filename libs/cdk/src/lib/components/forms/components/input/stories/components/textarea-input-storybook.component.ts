import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-textarea-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-textarea-input [cols]="cols" [rows]="rows" />
      <et-label>Textarea input</et-label>
    </et-input-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, ReactiveFormsModule],
})
export class StorybookTextareaInputComponent {
  fg = new FormControl();

  @Input()
  cols: number | null = null;

  @Input()
  rows: number | null = null;
}

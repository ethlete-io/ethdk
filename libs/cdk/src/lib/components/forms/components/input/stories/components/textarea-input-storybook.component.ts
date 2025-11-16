import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AutosizeTextareaDirective } from '../../directives/autosize-textarea';
import { InputImports } from '../../input.imports';

@Component({
  selector: 'et-sb-textarea-input',
  template: `
    <et-input-field [formControl]="fg">
      <et-textarea-input [cols]="cols()" [rows]="rows()" />
      <et-label>Textarea input</et-label>
    </et-input-field>

    <p>Auto size</p>
    <et-input-field [formControl]="fg">
      <et-textarea-input [cols]="cols()" [rows]="rows()" etAutosize etAutosizeMaxHeight="60" />
      <et-label>Textarea input</et-label>
    </et-input-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [InputImports, AutosizeTextareaDirective, ReactiveFormsModule],
})
export class StorybookTextareaInputComponent {
  fg = new FormControl();

  readonly cols = input<number | null>(null);

  readonly rows = input<number | null>(null);
}

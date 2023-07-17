import { JsonPipe, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ComboboxImports, ComboboxOptionTemplateDirective } from '../../../../..';

@Component({
  selector: 'et-sb-combobox',
  template: `
    <et-select-field [formControl]="fg">
      <et-label>Select</et-label>

      <et-combobox
        [options]="options"
        [bindLabel]="bindLabel"
        [bindValue]="bindValue"
        [multiple]="multiple"
        [initialValue]="initialValue"
        [loading]="loading"
        [error]="error"
        [placeholder]="placeholder"
        [allowCustomValues]="allowCustomValues"
        [filterInternal]="filterInternal"
      >
        <ng-container *ngIf="customOptionTemplate()">
          <ng-template etComboboxOptionTemplate let-option="option">
            {{ option.name || option }} (Custom tpl)
          </ng-template>
        </ng-container>
      </et-combobox>
    </et-select-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ComboboxImports, ReactiveFormsModule, JsonPipe, ComboboxOptionTemplateDirective, NgIf],
})
export class StorybookComboboxComponent {
  private readonly _cdr = inject(ChangeDetectorRef);

  fg = new FormControl({ value: null, disabled: false });

  options: unknown[] = [];

  bindLabel: string | null = null;
  bindValue: string | null = null;

  multiple = true;

  initialValue: unknown;

  loading = false;

  error = null;

  placeholder = 'Select an option';

  allowCustomValues = false;

  filterInternal = true;

  set _formValue(value: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fg.setValue(value as any);
  }

  set _customOptionTemplate(value: boolean) {
    this.customOptionTemplate.set(value);

    setTimeout(() => {
      this._cdr.markForCheck();
    }, 1);
  }

  customOptionTemplate = signal(false);
}

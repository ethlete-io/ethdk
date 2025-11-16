import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  inject,
  signal,
  input,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ComboboxImports } from '../../combobox.imports';

@Component({
  selector: 'et-sb-combobox-selected-option',
  template: ` <p>{{ option() | json }}</p> `,
  imports: [JsonPipe],
})
export class StorybookComboboxSelectedOptionComponent {
  readonly option = input<unknown>();
}

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
        [selectedOptionComponent]="customOptionComponent() ? customSelectedOptionComponent : null"
        [optionComponent]="customOptionComponent() ? customSelectedOptionComponent : null"
      >
        @if (customOptionTemplate()) {
          <ng-template etComboboxOptionTemplate let-option="option">
            {{ option.name || option }} (Custom tpl)
          </ng-template>
          <ng-template etComboboxSelectedOptionTemplate let-option="option">
            {{ option.name || option }} (Custom tpl)
          </ng-template>
          <ng-template etComboboxBodyEmptyTemplate>
            <i>Oh no, there are no items that match this query...</i> <b>(Custom tpl)</b>
          </ng-template>
        }
      </et-combobox>
    </et-select-field>

    <pre> {{ fg.value | json }} </pre>

    <button (click)="clearValue()">Clear</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      et-sb-combobox {
        display: block;
        padding-top: 150px;
      }

      pre {
        padding-bottom: 100px;
      }
    `,
  ],
  imports: [ComboboxImports, ReactiveFormsModule, JsonPipe],
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

  set _customOptionComponent(value: boolean) {
    this.customOptionComponent.set(value);

    setTimeout(() => {
      this._cdr.markForCheck();
    }, 1);
  }

  customOptionTemplate = signal(false);
  customOptionComponent = signal(false);

  customSelectedOptionComponent = StorybookComboboxSelectedOptionComponent;

  bindValueFn = (option: { id: number; name: string } | { foo: number; name: string }) =>
    'id' in option ? option.id : option.foo;
  bindLabelFn = (option: { id: number; name: string }) => option.name;

  clearValue() {
    if (this.multiple) {
      this._formValue = [];
    } else {
      this._formValue = null;
    }
  }
}

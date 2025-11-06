import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NativeSelectImports } from '../../native-select.imports';

@Component({
  selector: 'et-sb-native-select',
  template: `
    <et-select-field [formControl]="fg">
      <et-label>Native Select</et-label>

      <et-native-select>
        <et-native-select-option disabled hidden>Please choose</et-native-select-option>

        <et-native-select-option value="string">String</et-native-select-option>
        <et-native-select-option [value]="true">Boolean</et-native-select-option>
        <et-native-select-option [value]="2">Number 2</et-native-select-option>
        <et-native-select-option [value]="undefined">Undefined</et-native-select-option>
      </et-native-select>
    </et-select-field>

    <pre> {{ fg.value | json }} </pre>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NativeSelectImports, ReactiveFormsModule, JsonPipe],
})
export class StorybookNativeSelectComponent {
  fg = new FormControl(null);
}

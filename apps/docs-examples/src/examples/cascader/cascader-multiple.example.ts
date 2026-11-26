import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { CASCADER_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';
import { competitions } from './cascader-multiple.data';

@Component({
  selector: 'app-cascader-multiple-example',
  template: `
    <et-form-field>
      <et-label>Match</et-label>
      <et-cascader
        [formField]="matchForm.match"
        [dataSource]="COMPETITIONS"
        placeholder="Browse competitions"
        multiple
      />
      <et-hint>Leaf picks toggle - parents show the dash, or a full check once every child is picked</et-hint>
    </et-form-field>

    <p>Form value: {{ matchForm.match().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, CASCADER_IMPORTS, FormField, JsonPipe],
})
export class CascaderMultipleExampleComponent {
  protected readonly COMPETITIONS = competitions;

  private model = signal({ match: [] as string[] });

  protected matchForm = form(this.model);
}

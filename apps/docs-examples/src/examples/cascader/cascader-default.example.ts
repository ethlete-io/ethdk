import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { CASCADER_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';
import { competitions } from './cascader-default.data';

@Component({
  selector: 'app-cascader-default-example',
  template: `
    <et-form-field>
      <et-label>Match</et-label>
      <et-cascader [formField]="matchForm.match" [dataSource]="COMPETITIONS" placeholder="Browse competitions" />
    </et-form-field>

    <p>Form value: {{ matchForm.match().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, CASCADER_IMPORTS, FormField, JsonPipe],
})
export class CascaderDefaultExampleComponent {
  protected readonly COMPETITIONS = competitions;

  private model = signal({ match: null as string | null });

  protected matchForm = form(this.model);
}

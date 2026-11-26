import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { CASCADER_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';
import { competitions } from './cascader-search.data';

@Component({
  selector: 'app-cascader-search-example',
  template: `
    <et-form-field>
      <et-label>Match</et-label>
      <et-cascader [formField]="matchForm.match" [dataSource]="COMPETITIONS" placeholder="Browse competitions" />
      <et-hint>Type in the panel to search across all levels at once</et-hint>
    </et-form-field>

    <p>Form value: {{ matchForm.match().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, CASCADER_IMPORTS, FormField, JsonPipe],
})
export class CascaderSearchExampleComponent {
  protected readonly COMPETITIONS = competitions;

  private model = signal({ match: null as string | null });

  protected matchForm = form(this.model);
}

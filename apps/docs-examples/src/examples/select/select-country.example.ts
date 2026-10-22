import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import { COUNTRIES } from './select-country.data';

@Component({
  selector: 'app-select-country-example',
  template: `
    <et-form-field>
      <et-label>Country</et-label>
      <et-select [formField]="countryForm.country" placeholder="Pick a country">
        <input etSelectSearch placeholder="Search countries" />

        <ng-template etSelectValue let-entries>
          @for (entry of entries; track entry.value) {
            <span>
              <span aria-hidden="true">{{ flagOf(entry.value) }}</span>
              {{ entry.label }}
            </span>
          }
        </ng-template>

        @for (country of COUNTRIES; track country.iso) {
          <et-select-option [value]="country.iso" [label]="country.name">
            <span aria-hidden="true">{{ country.flag }}</span>
            {{ country.name }}
          </et-select-option>
        }
      </et-select>
      <et-hint>Custom option and value rendering (flags) + search</et-hint>
    </et-form-field>

    <p>Form value: {{ countryForm.country().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS, FormField, JsonPipe],
})
export class SelectCountryExampleComponent {
  protected readonly COUNTRIES = COUNTRIES;

  private model = signal({ country: 'de' as string | null });

  protected countryForm = form(this.model);

  protected flagOf(iso: unknown) {
    return COUNTRIES.find((country) => country.iso === iso)?.flag ?? '';
  }
}

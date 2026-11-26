import { Component, signal } from '@angular/core';
import '../../../test-helpers';
import { CHECKBOX_IMPORTS } from '../checkbox/checkbox.imports';
import { mountChoiceField } from '../testing/choice-field-driver';
import { CHOICE_FIELD_IMPORTS } from './choice-field.imports';

@Component({
  template: `
    <et-choice-field variant="card">
      <et-checkbox [checked]="checked()" (checkedChange)="checked.set($event)" />
      <et-label>Accept terms</et-label>
    </et-choice-field>
  `,
  imports: [CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS],
})
class ChoiceFieldNullHost {
  checked = signal(null as unknown as boolean);
}

describe('ChoiceFieldComponent (null bound value)', () => {
  it('renders a card around a checkbox bound to null and checks it on a label click', () => {
    const driver = mountChoiceField(ChoiceFieldNullHost);

    expect(driver.query('et-checkbox [aria-checked="true"], et-checkbox[aria-checked="true"]')).toBeNull();

    driver.click(driver.query<HTMLElement>('et-label')!);

    expect(driver.host.checked()).toBe(true);
  });
});

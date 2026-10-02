import { Component, resource, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, maxLength, validateAsync } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';
import { FORM_FIELD_IMPORTS } from '../../form-field/form-field.imports';
import { SELECT_IMPORTS } from '../select.imports';

@Component({
  template: `
    <et-form-field>
      <et-label>Assignee</et-label>
      <et-select [formField]="demoForm.assignee" placeholder="Pick a user">
        <et-select-option value="anne">Anne</et-select-option>
        <et-select-option value="peter">Peter</et-select-option>
      </et-select>
    </et-form-field>

    <et-form-field>
      <et-label>Reviewers</et-label>
      <et-select [formField]="demoForm.reviewers" multiple placeholder="Pick reviewers">
        <et-select-option value="anne">Anne</et-select-option>
        <et-select-option value="peter">Peter</et-select-option>
      </et-select>
      <et-counter />
    </et-form-field>
  `,
  imports: [FormField, FORM_FIELD_IMPORTS, SELECT_IMPORTS],
})
class SelectFieldStateTestHost {
  model = signal({ assignee: 'anne', reviewers: ['peter'] });
  demoForm = form(this.model, (s) => {
    maxLength(s.reviewers, 3);
    validateAsync(s.assignee, {
      params: ({ value }) => value(),
      factory: (params) => resource({ params, loader: () => new Promise<null>(() => undefined) }),
      onSuccess: () => null,
      onError: () => null,
    });
  });
}

describe('SelectDirective field state from signal forms', () => {
  let fields: HTMLElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

    const fixture = TestBed.createComponent(SelectFieldStateTestHost);

    fixture.detectChanges();
    fields = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('et-form-field'));
  });

  it('marks the field busy while an async validator is pending', () => {
    expect(fields[0]!.getAttribute('aria-busy')).toBe('true');
    expect(fields[1]!.hasAttribute('aria-busy')).toBe(false);
  });

  it('feeds the schema maxLength to the counter', () => {
    expect(fields[1]!.querySelector('et-counter [aria-hidden]')?.textContent?.trim()).toBe('1 / 3');
  });
});

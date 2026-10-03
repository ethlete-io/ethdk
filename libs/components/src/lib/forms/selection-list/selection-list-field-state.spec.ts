import { Component, resource, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, validateAsync } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { CHECKBOX_GROUP_IMPORTS, RADIO_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS } from './selection-list.imports';

@Component({
  template: `
    <et-radio-group [formField]="demoForm.plan" aria-label="Plan">
      <et-radio value="free">Free</et-radio>
      <et-radio value="pro">Pro</et-radio>
    </et-radio-group>

    <et-checkbox-group [formField]="demoForm.addons" aria-label="Add-ons">
      <et-checkbox-option value="stats">Stats</et-checkbox-option>
    </et-checkbox-group>

    <et-segmented-button-group [formField]="demoForm.view" aria-label="View">
      <et-segmented-button value="list">List</et-segmented-button>
      <et-segmented-button value="grid">Grid</et-segmented-button>
    </et-segmented-button-group>

    <et-radio-group [formField]="demoForm.settled" aria-label="Settled">
      <et-radio value="yes">Yes</et-radio>
    </et-radio-group>
  `,
  imports: [FormField, RADIO_GROUP_IMPORTS, CHECKBOX_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS],
})
class SelectionListFieldStateTestHost {
  model = signal({ plan: 'free', addons: [] as string[], view: 'list', settled: 'yes' });
  demoForm = form(this.model, (s) => {
    for (const path of [s.plan, s.addons, s.view]) {
      validateAsync(path, {
        params: ({ value }) => value(),
        factory: (params) => resource({ params, loader: () => new Promise<null>(() => undefined) }),
        onSuccess: () => null,
        onError: () => null,
      });
    }
  });
}

describe('selection-list groups field state from signal forms', () => {
  it('marks each group busy while an async validator is pending', () => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

    const fixture = TestBed.createComponent(SelectionListFieldStateTestHost);

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const groups = Array.from(
      host.querySelectorAll<HTMLElement>('et-radio-group, et-checkbox-group, et-segmented-button-group'),
    );

    expect(groups.map((group) => group.getAttribute('aria-busy'))).toEqual(['true', 'true', 'true', null]);
  });
});

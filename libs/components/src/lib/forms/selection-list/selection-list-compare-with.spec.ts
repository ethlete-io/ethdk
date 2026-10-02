import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { SelectionListCompareWith } from './headless';
import { CHECKBOX_GROUP_IMPORTS, RADIO_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS } from './selection-list.imports';

type Plan = { id: number; name: string };

const plan = (id: number, name: string): Plan => ({ id, name });
const byId: SelectionListCompareWith<Plan> = (a, b) => a.id === b.id;

@Component({
  template: `
    <et-radio-group [formField]="demoForm.plan" [compareWith]="compareWith()" aria-label="Plan">
      @for (option of plans; track option.id) {
        <et-radio [value]="option">{{ option.name }}</et-radio>
      }
    </et-radio-group>

    <et-checkbox-group [formField]="demoForm.addons" [compareWith]="compareWith()" aria-label="Add-ons">
      @for (option of plans; track option.id) {
        <et-checkbox-option [value]="option">{{ option.name }}</et-checkbox-option>
      }
    </et-checkbox-group>

    <et-segmented-button-group [formField]="demoForm.view" [compareWith]="compareWith()" aria-label="View">
      @for (option of plans; track option.id) {
        <et-segmented-button [value]="option">{{ option.name }}</et-segmented-button>
      }
    </et-segmented-button-group>
  `,
  imports: [FormField, RADIO_GROUP_IMPORTS, CHECKBOX_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS],
})
class CompareWithTestHost {
  plans = [plan(1, 'Free'), plan(2, 'Club'), plan(3, 'Pro')];
  compareWith = signal<SelectionListCompareWith<Plan>>(byId);
  model = signal<{ plan: Plan | null; addons: Plan[]; view: Plan | null }>({
    plan: plan(2, 'Club'),
    addons: [plan(1, 'Free'), plan(3, 'Pro')],
    view: plan(3, 'Pro'),
  });
  demoForm = form(this.model);
}

describe('selection-list groups compareWith', () => {
  let fixture: ComponentFixture<CompareWithTestHost>;

  const checkedIn = (selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(`${selector} [aria-checked]`))
      .filter((option) => option.getAttribute('aria-checked') === 'true')
      .map((option) => option.textContent?.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

    fixture = TestBed.createComponent(CompareWithTestHost);
    fixture.detectChanges();
  });

  it('checks the options matching an object value loaded from elsewhere', () => {
    expect(checkedIn('et-radio-group')).toEqual(['Club']);
    expect(checkedIn('et-checkbox-group')).toEqual(['Free', 'Pro']);
    expect(checkedIn('et-segmented-button-group')).toEqual(['Pro']);
  });

  it('falls back to reference equality', () => {
    fixture.componentInstance.compareWith.set((a, b) => a === b);
    fixture.detectChanges();

    expect(checkedIn('et-radio-group')).toEqual([]);
    expect(checkedIn('et-checkbox-group')).toEqual([]);
  });

  it('never calls the comparator with a null value', () => {
    fixture.componentInstance.model.update((value) => ({ ...value, plan: null }));
    fixture.detectChanges();

    expect(checkedIn('et-radio-group')).toEqual([]);
  });

  it('writes the clicked option value into the model', () => {
    const radios = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('et-radio');

    radios[0]!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.model().plan).toBe(fixture.componentInstance.plans[0]);
  });
});

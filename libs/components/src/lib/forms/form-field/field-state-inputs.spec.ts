import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, hidden } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { CHECKBOX_IMPORTS } from '../checkbox/checkbox.imports';
import { CHOICE_FIELD_IMPORTS } from '../choice-field/choice-field.imports';
import { OTP_INPUT_IMPORTS } from '../otp-input/otp-input.imports';
import { RATING_IMPORTS } from '../rating/rating.imports';
import { SLIDER_IMPORTS } from '../slider/slider.imports';
import { SWITCH_IMPORTS } from '../switch/switch.imports';

@Component({
  template: `
    <et-rating [formField]="demoForm.rating" aria-label="Rating" />
    <et-slider [formField]="demoForm.volume" aria-label="Volume" />
    <et-otp-input [formField]="demoForm.code" aria-label="Code" />
    <et-choice-field>
      <et-checkbox [formField]="demoForm.terms" />
      <et-label>Terms</et-label>
    </et-choice-field>
  `,
  imports: [RATING_IMPORTS, SLIDER_IMPORTS, OTP_INPUT_IMPORTS, CHECKBOX_IMPORTS, CHOICE_FIELD_IMPORTS, FormField],
})
class SchemaHiddenTestHost {
  hide = signal(false);
  model = signal({ rating: null as number | null, volume: 10, code: '', terms: false });
  demoForm = form(this.model, (s) => {
    hidden(s.rating, () => this.hide());
    hidden(s.volume, () => this.hide());
    hidden(s.code, () => this.hide());
    hidden(s.terms, () => this.hide());
  });
}

@Component({
  template: `
    <et-rating warnings="Rating advisory" aria-label="Rating" />
    <et-range-slider warnings="Range advisory" />
    <et-otp-input hidden aria-label="Code" />
    <et-choice-field class="checkbox-field">
      <et-checkbox warnings="Checkbox advisory" />
      <et-label>Terms</et-label>
    </et-choice-field>
    <et-choice-field class="switch-field">
      <et-switch hidden />
      <et-label>Notify</et-label>
    </et-choice-field>
  `,
  imports: [RATING_IMPORTS, SLIDER_IMPORTS, OTP_INPUT_IMPORTS, CHECKBOX_IMPORTS, SWITCH_IMPORTS, CHOICE_FIELD_IMPORTS],
})
class UnboundStateTestHost {}

const mount = <T>(host: new () => T) => {
  TestBed.configureTestingModule({ imports: [host], providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  const fixture = TestBed.createComponent(host);

  fixture.detectChanges();

  return fixture;
};

describe('self-hosted control field state', () => {
  it('hides each control while its schema hidden() rule holds', () => {
    const fixture = mount(SchemaHiddenTestHost);
    const host = fixture.nativeElement as HTMLElement;
    const display = (selector: string) => (host.querySelector(selector) as HTMLElement).style.display;

    const selectors = ['et-rating', 'et-slider', 'et-otp-input', 'et-choice-field'];

    expect(selectors.map(display)).toEqual(['', '', '', '']);

    fixture.componentInstance.hide.set(true);
    fixture.detectChanges();

    expect(selectors.map(display)).toEqual(['none', 'none', 'none', 'none']);
  });

  it('takes warnings and hidden as plain inputs on an unbound control', async () => {
    const fixture = mount(UnboundStateTestHost);

    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('et-rating')?.textContent).toContain('Rating advisory');
    expect(host.querySelector('et-range-slider')?.textContent).toContain('Range advisory');
    expect((host.querySelector('et-otp-input') as HTMLElement).style.display).toBe('none');
    expect(host.querySelector('.checkbox-field')?.textContent).toContain('Checkbox advisory');
    expect((host.querySelector('.switch-field') as HTMLElement).style.display).toBe('none');
  });
});

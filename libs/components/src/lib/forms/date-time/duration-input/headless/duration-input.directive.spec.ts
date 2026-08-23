import { Component, signal } from '@angular/core';
import '../../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../../form-field/headless';
import { DurationInputDriver, mountDurationInput } from '../../../testing/duration-input-driver';
import { DURATION_INPUT_IMPORTS } from '../duration-input.imports';

@Component({
  template: `
    <et-duration-input
      [value]="value()"
      [mixed]="mixed()"
      [durationFormat]="durationFormat()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      (touchedChange)="touched.set($event)"
      placeholder="mm:ss"
    />
  `,
  imports: [DURATION_INPUT_IMPORTS],
})
class DurationInputTestHost {
  value = signal<number | null>(null);
  mixed = signal(false);
  touched = signal(false);
  disabled = signal(false);
  durationFormat = signal('mm:ss');
}

@Component({
  template: `<et-duration-input aria-label="Time logged" />`,
  imports: [DURATION_INPUT_IMPORTS],
})
class AriaLabelDurationInputTestHost {}

@Component({
  template: `
    <div etFormField>
      <et-label>Projected label</et-label>
      <et-duration-input aria-labelledby="external-label-id" />
    </div>
  `,
  imports: [DURATION_INPUT_IMPORTS, FormFieldDirective, LabelDirective],
})
class AriaLabelledbyOverrideTestHost {}

describe('DurationInputDirective accessible name forwarding', () => {
  it('forwards a consumer aria-label onto the field', () => {
    const driver = mountDurationInput(AriaLabelDurationInputTestHost);

    expect(driver.field().getAttribute('aria-label')).toBe('Time logged');
  });

  it('lets a consumer aria-labelledby override the projected label id', () => {
    const driver = mountDurationInput(AriaLabelledbyOverrideTestHost, { directiveSelector: 'et-duration-input' });

    expect(driver.field().getAttribute('aria-labelledby')).toBe('external-label-id');
  });
});

describe('DurationInputDirective', () => {
  let driver: DurationInputDriver<DurationInputTestHost>;

  beforeEach(() => {
    driver = mountDurationInput(DurationInputTestHost);
  });

  it('renders a numeric text field', () => {
    expect(driver.field().getAttribute('type')).toBe('text');
    expect(driver.field().getAttribute('inputmode')).toBe('numeric');
  });

  it('displays a preset value formatted', () => {
    driver.host.value.set(90_000);
    driver.tick();

    expect(driver.fieldValue()).toBe('01:30');
  });

  it('commits a lenient bare-digit entry on blur (130 → 1:30)', () => {
    driver.focus();
    driver.type('130');
    driver.blur();

    expect(driver.host.value()).toBe(90_000);
    expect(driver.fieldValue()).toBe('01:30');
  });

  it('commits and reformats in place on Enter', () => {
    driver.focus();
    driver.type('90');
    driver.enter();

    expect(driver.host.value()).toBe(90_000);
    expect(driver.fieldValue()).toBe('01:30');
  });

  it('respects a custom format layout', () => {
    driver.host.durationFormat.set('hh:mm:ss');
    driver.tick();

    driver.focus();
    driver.type('12345');
    driver.blur();

    expect(driver.host.value()).toBe(5_025_000);
    expect(driver.fieldValue()).toBe('01:23:45');
  });

  it('keeps unparseable text visible and flags a parse error', () => {
    driver.focus();
    driver.type('abc');
    driver.blur();

    expect(driver.host.value()).toBeNull();
    expect(driver.durationInput.parseError()).toBe(true);
    expect(driver.fieldValue()).toBe('abc');
    expect(driver.durationInput.shouldDisplayError()).toBe(true);
  });

  it('clears the value on an empty commit', () => {
    driver.host.value.set(90_000);
    driver.tick();

    driver.focus();
    driver.type('');
    driver.blur();

    expect(driver.host.value()).toBeNull();
    expect(driver.durationInput.parseError()).toBe(false);
  });

  it('marks the control touched on blur', () => {
    driver.focus();
    expect(document.activeElement).toBe(driver.field());

    driver.blur();
    expect(document.activeElement).not.toBe(driver.field());

    expect(driver.host.touched()).toBe(true);
  });

  it('ignores input while disabled', () => {
    driver.host.disabled.set(true);
    driver.tick();

    expect(driver.field().disabled).toBe(true);

    driver.durationInput.commitInput('130');
    expect(driver.host.value()).toBeNull();
  });
});

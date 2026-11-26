import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { FORM_FIELD_IMPORTS, InputComponent, provideOverlay, SelectComponent, SelectOptionComponent } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-remote-user-select',
  imports: [FORM_FIELD_IMPORTS, SelectComponent, SelectOptionComponent],
  template: `
    <et-form-field>
      <et-label>User</et-label>
      <et-select [loading]="loading()" placeholder="Pick a user">
        <et-select-option value="ada">Ada</et-select-option>
      </et-select>
    </et-form-field>
  `,
})
class RemoteUserSelectComponent {
  loading = signal(false);
}

@Component({
  selector: 'et-scenario-handle-field',
  imports: [FORM_FIELD_IMPORTS, InputComponent],
  template: `
    <et-form-field [busy]="saving()">
      <et-label>Handle</et-label>
      <et-input [pending]="validating()" />
    </et-form-field>
  `,
})
class HandleFieldComponent {
  validating = signal(false);
  saving = signal(false);
}

const triggerSpinner = (host: HTMLElement) => host.querySelector('.et-select-trigger-busy');
const fieldSpinner = (host: HTMLElement) => host.querySelector('.et-form-field-busy-spinner');

const advance = (s: Scenario, ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    s.tick(10);
  }
};

const everShown = (s: Scenario, ms: number, probe: () => Element | null) => {
  let shown = false;

  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    s.tick(10);
    shown ||= probe() !== null;
  }

  return shown;
};

describe('form field busy spinner scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('never shows the select spinner for a load that settles within 200ms', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RemoteUserSelectComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.loading.set(true);
    s.tick();

    expect(everShown(s, 150, () => triggerSpinner(host))).toBe(false);

    fixture.componentInstance.loading.set(false);

    expect(everShown(s, 600, () => triggerSpinner(host))).toBe(false);
  });

  it('shows the select spinner 200ms into a load and holds it for 300ms', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RemoteUserSelectComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.loading.set(true);
    s.tick();

    advance(s, 190);
    expect(triggerSpinner(host)).toBeNull();

    advance(s, 20);
    expect(triggerSpinner(host)).not.toBeNull();

    fixture.componentInstance.loading.set(false);
    advance(s, 270);
    expect(triggerSpinner(host)).not.toBeNull();

    advance(s, 40);
    s.flush();
    expect(triggerSpinner(host)).toBeNull();
  });

  it('holds the select spinner for 300ms when the panel opens mid-load', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RemoteUserSelectComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.loading.set(true);
    s.tick();
    advance(s, 210);
    expect(triggerSpinner(host)).not.toBeNull();

    host.querySelector<HTMLElement>('[role="combobox"]')?.click();
    advance(s, 50);
    expect(triggerSpinner(host)).not.toBeNull();

    advance(s, 260);
    expect(triggerSpinner(host)).toBeNull();

    fixture.componentInstance.loading.set(false);
    s.keydown('Escape', document);
    s.flush();
  });

  it('shows no spinner while an async validator runs, only aria-busy', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HandleFieldComponent);
    const host = fixture.nativeElement as HTMLElement;
    const field = host.querySelector('et-form-field');

    fixture.componentInstance.validating.set(true);
    s.tick();

    expect(everShown(s, 1000, () => fieldSpinner(host))).toBe(false);
    expect(field?.getAttribute('aria-busy')).toBe('true');

    fixture.componentInstance.validating.set(false);
    s.flush();
    expect(field?.hasAttribute('aria-busy')).toBe(false);
  });

  it('shows the field spinner for [busy] 200ms in and holds it for 300ms', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HandleFieldComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.saving.set(true);
    s.tick();

    advance(s, 190);
    expect(fieldSpinner(host)).toBeNull();

    advance(s, 20);
    expect(fieldSpinner(host)).not.toBeNull();

    fixture.componentInstance.saving.set(false);
    advance(s, 270);
    expect(fieldSpinner(host)).not.toBeNull();

    advance(s, 40);
    s.flush();
    expect(fieldSpinner(host)).toBeNull();
  });
});

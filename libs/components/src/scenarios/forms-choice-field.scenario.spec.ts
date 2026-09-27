import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  CHECKBOX_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  CHOICE_FIELD_VARIANTS,
  ChoiceFieldVariant,
  SELECTION_CARD_CONTROL_POSITIONS,
  SelectionCardControlPosition,
  SWITCH_IMPORTS,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-notification-settings',
  imports: [CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS, SWITCH_IMPORTS, FormField],
  template: `
    <et-choice-field [variant]="variant()" [controlPosition]="position()" class="terms">
      <et-checkbox [formField]="settings.terms" />
      <et-label>Accept the terms</et-label>
      <span class="badge" etSelectionCardTrailing>Required</span>
      <et-hint>You can read them any time</et-hint>
    </et-choice-field>
    <et-choice-field class="alerts">
      <et-switch [formField]="settings.alerts" />
      <et-label>Match alerts</et-label>
    </et-choice-field>
  `,
})
class NotificationSettingsComponent {
  variant = signal<ChoiceFieldVariant>(CHOICE_FIELD_VARIANTS.PLAIN);
  position = signal<SelectionCardControlPosition>(SELECTION_CARD_CONTROL_POSITIONS.END);
  model = signal({ terms: false, alerts: true });
  settings = form(this.model, (path) => {
    required(path.terms, { message: 'Accept the terms to continue' });
  });
}

const query = <T extends Element = HTMLElement>(host: Element, selector: string) => {
  const element = host.querySelector<T>(selector);

  if (!element) throw new Error(`No element for ${selector}`);

  return element;
};

describe('choice field scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('names each control by its label and toggles it from a label click or Space', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NotificationSettingsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const checkbox = query(host, 'et-checkbox');
    const toggle = query(host, 'et-switch');

    expect(checkbox.getAttribute('role')).toBe('checkbox');
    expect(query(host, `#${checkbox.getAttribute('aria-labelledby')}`).textContent).toContain('Accept the terms');
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    query(host, '.terms et-label').click();
    s.tick();

    expect(fixture.componentInstance.model().terms).toBe(true);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    s.keydown(' ', toggle);
    s.tick();

    expect(fixture.componentInstance.model().alerts).toBe(false);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    s.flush();
  });

  it('keeps the hint until a touched, unchecked required box shows its error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NotificationSettingsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const field = query(host, '.terms');
    const checkbox = query(host, 'et-checkbox');

    expect(query(field, '.et-form-support-hint').getAttribute('data-active')).toBe('true');
    expect(checkbox.getAttribute('aria-required')).toBe('true');
    expect(field.hasAttribute('data-error')).toBe(false);

    checkbox.focus();
    checkbox.blur();
    s.tick();

    expect(field.getAttribute('data-error')).toBe('true');
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(query(field, '.et-form-support-errors').textContent).toContain('Accept the terms to continue');

    expect(checkbox.getAttribute('aria-describedby')?.split(' ')).toContain(query(field, '.et-form-support-errors').id);

    checkbox.click();
    s.tick();

    expect(field.hasAttribute('data-error')).toBe(false);
    s.flush();
  });

  it('turns into a card panel whose control moves to either end', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NotificationSettingsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const field = query(host, '.terms');

    s.tick();

    expect(field.getAttribute('data-variant')).toBe('plain');
    expect(field.hasAttribute('data-control-position')).toBe(false);
    expect(query(field, '.et-choice-field-control').classList).not.toContain('et-selection-card');

    fixture.componentInstance.variant.set(CHOICE_FIELD_VARIANTS.CARD);
    s.tick();

    expect(field.getAttribute('data-variant')).toBe('card');
    expect(field.getAttribute('data-control-position')).toBe('end');
    expect(query(field, '.et-choice-field-control').classList).toContain('et-selection-card');
    expect(query(field, '.et-choice-field-control > .badge').textContent).toBe('Required');

    fixture.componentInstance.position.set(SELECTION_CARD_CONTROL_POSITIONS.START);
    s.tick();

    expect(field.getAttribute('data-control-position')).toBe('start');

    query(field, '.et-choice-field-label-area et-label').click();
    s.tick();

    expect(fixture.componentInstance.model().terms).toBe(true);
    s.flush();
  });
});

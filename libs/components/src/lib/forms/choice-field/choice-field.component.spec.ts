import { Component, signal } from '@angular/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../../test-helpers';
import { CHECKBOX_IMPORTS } from '../checkbox/checkbox.imports';
import { FORM_FIELD_CONTROL_TYPES } from '../form-field/headless';
import { SelectionCardControlPosition } from '../selection-card.types';
import { mountChoiceField } from '../testing/choice-field-driver';
import { ChoiceFieldVariant } from './choice-field.component';
import { CHOICE_FIELD_IMPORTS } from './choice-field.imports';

// jsdom drops the component stylesheet whole (`@layer`, nesting), and vitest stubs CSS imports to an
// empty string, so the source text is the only place a media query is observable from a spec.
const choiceFieldCss = readFileSync(
  fileURLToPath(import.meta.url).replace(/[^/]+$/, 'choice-field.component.css'),
  'utf8',
);

describe('ChoiceFieldComponent styles', () => {
  it('drives the support region transition from the duration token', () => {
    expect(choiceFieldCss).toContain('transition: block-size var(--et-choice-field-support-duration) ease');
  });

  it('collapses the support region motion under prefers-reduced-motion', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([^}]*)\}/.exec(choiceFieldCss)?.[1];

    expect(reduced).toBeDefined();
    expect(reduced).toContain('--et-choice-field-support-duration: 1ms');
    expect(reduced).toContain('--et-choice-field-support-offset: 0px');
  });
});

@Component({
  template: `
    <et-choice-field [controlPosition]="controlPosition()" [size]="size()" [variant]="variant()">
      <et-checkbox [checked]="checked()" (checkedChange)="checked.set($event)" />
      <et-label>Accept terms</et-label>
    </et-choice-field>
  `,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS],
})
class ChoiceFieldTestHost {
  checked = signal(false);
  variant = signal<ChoiceFieldVariant>('plain');
  controlPosition = signal<SelectionCardControlPosition>('end');
  size = signal<'sm' | 'md' | 'lg'>('md');
}

describe('ChoiceFieldComponent', () => {
  const mount = () => mountChoiceField(ChoiceFieldTestHost);

  it('reflects size and variant as host data attributes', () => {
    const driver = mount();

    expect(driver.attr('data-size')).toBe('md');
    expect(driver.attr('data-variant')).toBe('plain');

    driver.host.size.set('lg');
    driver.host.variant.set('card');
    driver.tick();

    expect(driver.attr('data-size')).toBe('lg');
    expect(driver.attr('data-variant')).toBe('card');
  });

  it('only exposes data-control-position while the card variant is active', () => {
    const driver = mount();

    driver.host.controlPosition.set('start');
    driver.tick();

    expect(driver.attr('data-control-position')).toBeNull();

    driver.host.variant.set('card');
    driver.tick();

    expect(driver.attr('data-control-position')).toBe('start');

    driver.host.variant.set('plain');
    driver.tick();

    expect(driver.attr('data-control-position')).toBeNull();
  });

  it('registers the projected checkbox as the form field control', () => {
    const driver = mount();

    expect(driver.formField.registeredControl()).toBeTruthy();
    expect(driver.formField.controlType()).toBe(FORM_FIELD_CONTROL_TYPES.CHECKBOX);
  });

  it('projects the control ahead of the label area', () => {
    const driver = mount();

    expect(driver.controlSlot().querySelector('et-checkbox')).not.toBeNull();
    expect(driver.labelArea().textContent?.trim()).toBe('Accept terms');
  });
});

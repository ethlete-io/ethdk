import { Component, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../../test-helpers';
import { CHECKBOX_IMPORTS } from '../checkbox/checkbox.imports';
import { FORM_FIELD_CONTROL_TYPES } from '../form-field/headless';
import { warn } from '../form-field/headless/field-warnings';
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

@Component({
  template: `
    <et-choice-field>
      <et-checkbox [formField]="choiceForm.acceptTerms" />
      <et-label>Accept terms</et-label>
      <et-hint>Optional</et-hint>
    </et-choice-field>
  `,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS, FormField],
})
class ChoiceFieldSupportTestHost {
  public model = signal({ acceptTerms: false });

  public choiceForm = form(
    this.model,
    (schema) => {
      required(schema.acceptTerms, { message: 'You must accept the terms' });
      warn(schema.acceptTerms, ({ value }) => (value() ? null : 'Please review the terms'));
    },
    { injector: TestBed.inject(Injector) },
  );
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

  it('renders support transitions in severity order', () => {
    const driver = mountChoiceField(ChoiceFieldSupportTestHost);

    const warning = () => driver.query('.et-choice-field-warnings');
    const hint = () => driver.query('.et-choice-field-hint');
    const error = () => driver.query('.et-choice-field-errors');

    expect(warning()?.getAttribute('data-direction')).toBe('from-below');
    expect(warning()?.getAttribute('data-state')).toBe('active');

    driver.host.model.set({ acceptTerms: true });
    driver.detectChanges();

    expect(hint()?.getAttribute('data-direction')).toBe('from-above');
    expect(hint()?.getAttribute('data-state')).toBe('active');
    expect(warning()?.getAttribute('data-direction')).toBe('to-below');
    expect(warning()?.getAttribute('data-state')).toBe('leaving');

    driver.host.model.set({ acceptTerms: false });
    driver.host.choiceForm.acceptTerms().markAsTouched();
    driver.detectChanges();

    expect(error()?.getAttribute('data-direction')).toBe('from-below');
    expect(error()?.getAttribute('data-state')).toBe('active');
    expect(hint()?.getAttribute('data-direction')).toBe('to-above');
    expect(hint()?.getAttribute('data-state')).toBe('leaving');
  });
});

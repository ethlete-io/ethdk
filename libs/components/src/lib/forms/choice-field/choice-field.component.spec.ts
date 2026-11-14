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
import { expectDescribedByPointsAtErrors, expectDescribedByResolves } from '../testing/described-by';
import { mountChoiceField } from '../testing/choice-field-driver';
import { ChoiceFieldLabelPosition, ChoiceFieldLayout, ChoiceFieldVariant } from './choice-field.component';
import { CHOICE_FIELD_IMPORTS } from './choice-field.imports';

// jsdom drops the component stylesheet whole (`@layer`, nesting), and vitest stubs CSS imports to an
// empty string, so the source text is the only place a media query is observable from a spec.
const choiceFieldCss = readFileSync(
  fileURLToPath(import.meta.url).replace(/[^/]+$/, 'choice-field.component.css'),
  'utf8',
);

describe('ChoiceFieldComponent styles', () => {
  it('feeds the shared support region from its own public tokens', () => {
    expect(choiceFieldCss).toContain('--et-form-support-duration: var(--et-choice-field-support-duration)');
    expect(choiceFieldCss).toContain('--et-form-support-error-font-size: var(--et-choice-field-error-font-size)');
    expect(choiceFieldCss).toContain('--et-form-support-warning-font-size: var(--et-choice-field-warning-font-size)');
    expect(choiceFieldCss).toContain('--et-form-support-hint-font-size: var(--et-choice-field-hint-font-size)');
  });

  const blockAfter = (selector: string) => choiceFieldCss.slice(choiceFieldCss.indexOf(selector)).replace(/\s+/g, ' ');

  it('moves the label area ahead of the control with labelPosition start', () => {
    expect(blockAfter("&:where([data-label-position='start'])")).toMatch(
      /^&:where\(\[data-label-position='start'\]\) \{ \.et-choice-field-label-area \{ order: -1; \}/,
    );
  });

  it('makes the control slot and the label area items of a subgrid in the subgrid layout', () => {
    const subgrid = blockAfter("&:where([data-layout='subgrid'])");

    expect(subgrid).toMatch(/^[^}]*display: grid;[^}]*grid-template-columns: subgrid;[^}]*grid-column: span 2;/);
    expect(subgrid).toContain('.et-choice-field-control { display: contents; }');
  });

  it('indents the support text past the leading control, and not on a card', () => {
    expect(choiceFieldCss).toContain(
      'padding-inline-start: calc(var(--et-choice-field-gap) + var(--et-checkbox-size, 20px))',
    );
    const cardBlock = choiceFieldCss.slice(choiceFieldCss.indexOf("&:where([data-variant='card'])"));

    expect(choiceFieldCss).toContain("&:where([data-variant='card'])");
    expect(cardBlock).toContain('.et-form-support-errors');
    expect(cardBlock).toContain('.et-form-support-warnings');
    expect(cardBlock).toContain('.et-form-support-hint');
  });
});

@Component({
  template: `
    <et-choice-field
      [controlPosition]="controlPosition()"
      [labelPosition]="labelPosition()"
      [layout]="layout()"
      [size]="size()"
      [variant]="variant()"
    >
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
  labelPosition = signal<ChoiceFieldLabelPosition>('end');
  layout = signal<ChoiceFieldLayout>('inline');
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

@Component({
  template: `
    <et-choice-field variant="card">
      <et-checkbox [checked]="checked()" (checkedChange)="checked.set($event)" />
      <et-label>
        I accept the
        <a href="#terms"><span class="terms-text">terms</span></a>
      </et-label>
    </et-choice-field>
  `,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS],
})
class ChoiceFieldLinkedLabelTestHost {
  checked = signal(false);
}

describe('ChoiceFieldComponent', () => {
  const mount = () => mountChoiceField(ChoiceFieldTestHost);

  it('follows a link in the label without toggling the control', () => {
    const driver = mountChoiceField(ChoiceFieldLinkedLabelTestHost);

    driver.click(driver.query<HTMLElement>('.terms-text')!);
    expect(driver.host.checked()).toBe(false);

    driver.click(driver.query<HTMLElement>('et-label')!);
    expect(driver.host.checked()).toBe(true);
  });

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

  it('only exposes non-default data-label-position and data-layout on the plain variant', () => {
    const driver = mount();

    expect(driver.attr('data-label-position')).toBeNull();
    expect(driver.attr('data-layout')).toBeNull();

    driver.host.labelPosition.set('start');
    driver.host.layout.set('subgrid');
    driver.tick();

    expect(driver.attr('data-label-position')).toBe('start');
    expect(driver.attr('data-layout')).toBe('subgrid');

    driver.host.variant.set('card');
    driver.tick();

    expect(driver.attr('data-label-position')).toBeNull();
    expect(driver.attr('data-layout')).toBeNull();
  });

  it('toggles the control from the label text with labelPosition start in the subgrid layout', () => {
    const driver = mount();

    driver.host.labelPosition.set('start');
    driver.host.layout.set('subgrid');
    driver.tick();

    driver.click(driver.query<HTMLElement>('et-label')!);
    expect(driver.host.checked()).toBe(true);

    driver.click(driver.query<HTMLElement>('et-label')!);
    expect(driver.host.checked()).toBe(false);
    expect(driver.controlSlot().querySelector('[role="checkbox"]')?.getAttribute('aria-labelledby')).toBe(
      driver.query<HTMLElement>('et-label')!.id,
    );
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

  it('shows one support severity at a time', () => {
    const driver = mountChoiceField(ChoiceFieldSupportTestHost);

    const warning = () => driver.query('.et-form-support-warnings');
    const hint = () => driver.query('.et-form-support-hint');
    const error = () => driver.query('.et-form-support-errors');

    expect(warning()?.getAttribute('data-active')).toBe('true');
    expect(hint()).toBeNull();

    driver.host.model.set({ acceptTerms: true });
    driver.detectChanges();

    expect(hint()?.getAttribute('data-active')).toBe('true');
    expect(warning()?.getAttribute('data-active')).toBeNull();

    driver.host.model.set({ acceptTerms: false });
    driver.host.choiceForm.acceptTerms().markAsTouched();
    driver.detectChanges();

    expect(error()?.getAttribute('data-active')).toBe('true');
    expect(hint()?.getAttribute('data-active')).toBeNull();
  });

  it('renders the shared support region and keeps aria-describedby resolving', () => {
    const driver = mountChoiceField(ChoiceFieldSupportTestHost);

    expect(driver.query('.et-form-support')).not.toBeNull();

    driver.host.model.set({ acceptTerms: true });
    driver.detectChanges();

    expect(driver.query('.et-form-support-hint')).not.toBeNull();

    for (const described of driver.queryAll('[aria-describedby]')) {
      expectDescribedByResolves(described);
    }

    driver.host.model.set({ acceptTerms: false });
    driver.host.choiceForm.acceptTerms().markAsTouched();
    driver.detectChanges();

    expectDescribedByPointsAtErrors(driver.choiceFieldEl());
  });
});

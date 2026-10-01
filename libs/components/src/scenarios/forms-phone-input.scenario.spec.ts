import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  DEFAULT_PHONE_INPUT_LABELS,
  FORM_FIELD_IMPORTS,
  injectPhoneInputLabels,
  matchCountryByDialCode,
  PHONE_COUNTRIES,
  PHONE_INPUT_ERROR_CODES,
  PHONE_INPUT_LABELS,
  phoneCountryFlag,
  phoneCountryName,
  PhoneInputComponent,
  PhoneInputDirective,
  PhoneInputFieldDirective,
  PhoneInputFlagDirective,
  provideOverlay,
  providePhoneInputLabels,
  stripTrunkZero,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-contact-form',
  imports: [FORM_FIELD_IMPORTS, PhoneInputComponent, PhoneInputFlagDirective, FormField],
  providers: [providePhoneInputLabels({ searchCountries: 'Land suchen' })],
  template: `
    <et-form-field>
      <et-label>Phone</et-label>
      <et-phone-input
        [formField]="contact.phone"
        [preferredCountries]="['de', 'at']"
        defaultCountry="de"
        placeholder="171 234 5678"
      >
        <ng-template etPhoneInputFlag let-country>
          <span class="flag-code">{{ country.iso2 }}</span>
        </ng-template>
      </et-phone-input>
    </et-form-field>
    <p class="probe">{{ labels().noCountries }}</p>
  `,
})
class ContactFormComponent {
  model = signal({ phone: '' });
  contact = form(this.model, (path) => required(path.phone));
  labels = injectPhoneInputLabels();
  phone = viewChild.required(PhoneInputDirective);
}

@Component({
  selector: 'et-scenario-headless-phone',
  imports: [PhoneInputDirective, PhoneInputFieldDirective],
  providers: [{ provide: PHONE_INPUT_LABELS, useValue: { selectCountry: 'Pays' } }],
  template: `
    <div #phone="etPhoneInput" [(value)]="value" etPhoneInput defaultCountry="it" aria-label="Mobile">
      <select #country [value]="phone.country()" (change)="phone.selectCountry(country.value)" class="country">
        <option value="it">Italy</option>
        <option value="fr">France</option>
      </select>
      <input #field="etPhoneInputField" etPhoneInputField />
      <span class="plausible">{{ phone.isPlausible() }}</span>
    </div>
  `,
})
class HeadlessPhoneComponent {
  value = signal('');
  field = viewChild.required(PhoneInputFieldDirective);
}

@Component({
  selector: 'et-scenario-stray-phone-parts',
  imports: [PhoneInputFieldDirective, PhoneInputFlagDirective],
  template: `
    <input etPhoneInputField />
    <ng-template etPhoneInputFlag>flag</ng-template>
  `,
})
class StrayPhonePartsComponent {}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const pane = () => queryAll('.et-overlay-runtime-pane').at(-1) ?? null;

const typeInto = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

describe('forms phone input scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('types a national number, picks a country from the searchable panel and clears', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ContactFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const field = query<HTMLInputElement>('.et-phone-input-field', host);
    const trigger = query<HTMLButtonElement>('.et-phone-input-country-trigger', host);

    expect([field.type, field.getAttribute('autocomplete'), field.getAttribute('inputmode')]).toEqual([
      'tel',
      'tel',
      'tel',
    ]);
    expect(field.placeholder).toBe('171 234 5678');
    expect(field.getAttribute('aria-required')).toBe('true');
    expect(field.getAttribute('aria-labelledby')).toBe(query('et-label', host).id);
    const [countryLabelId, selfId] = trigger.getAttribute('aria-labelledby')?.split(' ') ?? [];
    const countryLabel = query(`#${countryLabelId}`, host);

    expect(selfId).toBe(trigger.id);
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(countryLabel.hidden).toBe(true);
    expect(text(countryLabel)).toBe(DEFAULT_PHONE_INPUT_LABELS.selectCountry);
    expect(text(query('.et-phone-input-country-flag', trigger))).toBe('de');
    expect(text(query('.et-phone-input-country-name', trigger))).toBe(phoneCountryName('de'));
    expect(text(query('.et-phone-input-dial-code', trigger))).toBe('+49');
    expect(text(query('.probe', host))).toBe('No countries found');

    field.focus();
    s.tick();
    typeInto(s, field, '0171 2345678');
    expect(app.model().phone).toBe('+491712345678');
    expect(app.contact.phone().valid()).toBe(true);

    const clear = query<HTMLButtonElement>('.et-input-clear', host);

    expect(clear.getAttribute('aria-label')).toBe('Clear');

    field.blur();
    s.tick();
    s.flush();
    expect(field.value).toBe('171 234 567 8');
    expect(app.contact.phone().touched()).toBe(true);
    expect(host.querySelector('.et-input-clear')).toBeNull();

    trigger.click();
    s.tick();
    s.flush();

    const panel = pane();

    if (!panel) throw new Error('no panel');

    const optionNames = queryAll('[role="option"] .et-phone-input-option-name', panel).map(text);

    expect(optionNames.slice(0, 2)).toEqual([phoneCountryName('de'), phoneCountryName('at')]);
    expect(optionNames).toHaveLength(PHONE_COUNTRIES.length);
    expect(query<HTMLInputElement>('[etSelectSearch], .et-select-panel-search input', panel).placeholder).toBe(
      'Land suchen',
    );

    const search = query<HTMLInputElement>('.et-select-panel-search input', panel);

    search.focus();
    typeInto(s, search, '+43');
    s.flush();

    const visible = queryAll('[role="option"]', panel).filter((option) => !option.hidden);

    expect(visible.map((option) => text(option.querySelector('.et-phone-input-option-dial')))).toContain('+43');

    const austria = visible.find((option) => text(option.querySelector('.et-phone-input-option-dial')) === '+43');

    austria?.click();
    s.tick();
    s.flush();
    expect(app.model().phone).toBe('+431712345678');
    expect(app.phone().country()).toBe('at');
    expect(text(query('.et-phone-input-country-name', trigger))).toBe(phoneCountryName('at'));
    expect(text(query('.et-phone-input-dial-code', trigger))).toBe('+43');
    expect(document.activeElement).toBe(field);

    s.tick();
    query<HTMLButtonElement>('.et-input-clear', host).click();
    s.tick();
    expect(app.model().phone).toBe('');
    expect(field.value).toBe('');
    expect(app.contact.phone().valid()).toBe(false);

    typeInto(s, field, '+1 415 555 0100');
    expect(app.model().phone).toBe('+14155550100');
    expect(app.phone().country()).toBe('us');
    s.flush();
  });

  it('builds a headless phone field that keeps the Italian trunk zero and follows a country switch', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessPhoneComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const field = query<HTMLInputElement>('input', host);

    expect(field.getAttribute('aria-label')).toBe('Mobile');

    field.focus();
    typeInto(s, field, '06 1234 5678');
    expect(app.value()).toBe('+390612345678');
    expect(text(query('.plausible', host))).toBe('true');

    const country = query<HTMLSelectElement>('.country', host);

    country.value = 'fr';
    country.dispatchEvent(new Event('change'));
    s.tick();
    expect(app.value()).toBe('+330612345678');

    typeInto(s, field, '0033 6 12 34 56 78');
    expect(app.value()).toBe('+33612345678');

    field.blur();
    s.tick();
    expect(field.value).toBe('612 345 678');

    app.value.set('+4930123456');
    s.tick();
    expect(field.value).toBe('301 234 56');

    app.field().focus();
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('30123456');

    typeInto(s, field, '12');
    expect(text(query('.plausible', host))).toBe('false');
  });

  it('matches dial codes, strips trunk zeros and names countries with the exported helpers', () => {
    scenario();

    expect(matchCountryByDialCode('4917112345')?.iso2).toBe('de');
    expect(matchCountryByDialCode('14155550100')?.iso2).toBe('us');
    expect(matchCountryByDialCode('')).toBeNull();
    expect(stripTrunkZero('01712345678', 'de')).toBe('1712345678');
    expect(stripTrunkZero('0612345678', 'it')).toBe('0612345678');
    expect(phoneCountryFlag('de')).toBe('🇩🇪');
    expect(phoneCountryName('de', 'en')).toBe('Germany');
    expect(phoneCountryName('de', 'de')).toBe('Deutschland');
    expect(PHONE_COUNTRIES.find((country) => country.iso2 === 'at')?.dialCode).toBe('43');
  });

  it('reports phone parts outside a phone input', () => {
    const s = scenario();

    TestBed.createComponent(StrayPhonePartsComponent);
    s.tick(1);

    s.expectError(`ET${PHONE_INPUT_ERROR_CODES.FIELD_OUTSIDE_PHONE_INPUT}`);
    s.expectError(`ET${PHONE_INPUT_ERROR_CODES.FLAG_TEMPLATE_OUTSIDE_PHONE_INPUT}`);
    s.errors.length = 0;
  });
});

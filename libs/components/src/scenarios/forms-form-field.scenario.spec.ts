import { Component, inject, signal, Type, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { disabled, email, form, FormField, hidden, maxLength, readonly, required } from '@angular/forms/signals';
import { compatForm, SignalFormControl } from '@angular/forms/signals/compat';
import { provideColorThemes } from '@ethlete/core';
import {
  CounterComponent,
  DEFAULT_FORM_FIELD_LABELS,
  FIELD_WARNING_KIND,
  FORM_ERROR_MESSAGE_RESOLVER,
  FORM_FIELD_LABELS,
  FORM_WARNING_MESSAGE_RESOLVER,
  FormErrorComponent,
  FormWarningComponent,
  injectFormFieldLabels,
  provideFormErrorMessageResolver,
  provideFormFieldLabels,
  provideFormWarningMessageResolver,
  FORM_FIELD_APPEARANCES,
  FORM_FIELD_ERROR_CODES,
  FORM_FIELD_FILLS,
  FORM_FIELD_IMPORTS,
  FORM_FIELD_LABEL_MODES,
  FORM_FIELD_SIZES,
  FormFieldComponent,
  FormFieldDirective,
  HintComponent,
  INPUT_IMPORTS,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelDirective,
  warn,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-signup',
  imports: [
    INPUT_IMPORTS,
    FormFieldComponent,
    LabelDirective,
    HintComponent,
    InputPrefixDirective,
    InputSuffixDirective,
    FormField,
  ],
  template: `
    <et-form-field>
      <et-label>Email</et-label>
      <span etInputPrefix>@</span>
      <et-input [formField]="signup.email" />
      <button class="email-suffix" etInputSuffix type="button">?</button>
      <et-hint>We never share it.</et-hint>
    </et-form-field>
  `,
})
class SignupComponent {
  formField = viewChild.required(FormFieldComponent);
  formFieldDir = viewChild.required(FormFieldDirective);
  model = signal({ email: '' });
  signup = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Not an email address' });
  });
}

@Component({
  selector: 'et-scenario-profile',
  imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS, FormField],
  template: `
    <et-form-field
      [appearance]="appearance()"
      [fill]="fill()"
      [labelMode]="labelMode()"
      [size]="size()"
      [busy]="busy()"
    >
      <et-label>Nickname</et-label>
      <et-input [formField]="profile.nickname" placeholder="e.g. Ace" />
      <et-counter />
    </et-form-field>
  `,
})
class ProfileComponent {
  model = signal({ nickname: '' });
  locked = signal(false);
  frozen = signal(false);
  gone = signal(false);
  appearance = signal<'box' | 'underline'>(FORM_FIELD_APPEARANCES.BOX);
  fill = signal<'transparent' | 'filled'>(FORM_FIELD_FILLS.TRANSPARENT);
  labelMode = signal<'static' | 'inline' | 'floating-inside' | 'floating-outside'>(FORM_FIELD_LABEL_MODES.STATIC);
  size = signal<'sm' | 'md' | 'lg'>(FORM_FIELD_SIZES.MD);
  busy = signal(false);
  profile = form(this.model, (path) => {
    maxLength(path.nickname, 10, { message: 'At most 10 characters' });
    disabled(path.nickname, () => this.locked());
    readonly(path.nickname, () => this.frozen());
    hidden(path.nickname, () => this.gone());
    warn(path.nickname, ({ value }) =>
      value() === value().toUpperCase() && value() ? 'That reads as shouting.' : null,
    );
  });
  counter = viewChild.required(CounterComponent);
}

@Component({
  selector: 'et-scenario-search',
  imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS],
  template: `
    <span id="search-caption">Filter the list</span>
    <et-form-field>
      <et-input [(value)]="term" [warnings]="advice()" aria-label="Search" />
    </et-form-field>
    <et-form-field>
      <et-label>Ignored label</et-label>
      <et-input [(value)]="other" aria-labelledby="search-caption" />
    </et-form-field>
  `,
})
class SearchComponent {
  term = signal('');
  other = signal('');
  advice = signal<string | null>(null);
}

@Component({
  selector: 'et-scenario-empty-field',
  imports: [FORM_FIELD_IMPORTS],
  template: '<et-form-field><et-label>Nothing</et-label></et-form-field>',
})
class EmptyFieldComponent {}

@Component({
  selector: 'et-scenario-unnamed-field',
  imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS],
  template: '<et-form-field><et-input placeholder="Not a name" /></et-form-field>',
})
class UnnamedFieldComponent {}

@Component({
  selector: 'et-scenario-legacy-form',
  imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS, FormField],
  template: `
    <et-form-field>
      <et-label>City</et-label>
      <et-input [formField]="city.fieldTree" />
    </et-form-field>
  `,
})
class LegacyFormComponent {
  city = new SignalFormControl('', (path) => required(path, { message: 'City is required' }));
  group = new FormGroup({ city: this.city });
}

@Component({
  selector: 'et-scenario-bulk-edit',
  imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS, FormField],
  template: `
    <et-form-field>
      <et-label>Street</et-label>
      <et-input [(mixed)]="mixed" [formField]="address.street" />
    </et-form-field>
    <et-form-field>
      <et-label>Zip</et-label>
      <et-input [formField]="address.zip" />
    </et-form-field>
    <et-form-field>
      <et-label>Note</et-label>
      <et-input [(value)]="note" [warnings]="noteWarnings()" />
    </et-form-field>
  `,
})
class BulkEditComponent {
  zip = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });
  model = signal({ street: 'Main St', zip: this.zip });
  address = compatForm(this.model, (path) =>
    warn(path.street, ({ value }) => (value().length > 20 ? { kind: 'longStreet' } : null)),
  );
  mixed = signal(true);
  note = signal('');
  noteWarnings = signal<string | null>(null);
  labels = injectFormFieldLabels();
  labelsToken = inject(FORM_FIELD_LABELS);
  errorResolver = inject(FORM_ERROR_MESSAGE_RESOLVER);
  warningResolver = inject(FORM_WARNING_MESSAGE_RESOLVER);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const type = (s: Scenario, field: HTMLInputElement, text: string) => {
  field.focus();
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

const componentOf = <T>(fixture: ComponentFixture<unknown>, type: Type<T>) =>
  fixture.debugElement.query(By.directive(type)).componentInstance as T;

const describedBy = (control: Element) => {
  const id = control.getAttribute('aria-describedby');

  return id ? document.getElementById(id) : null;
};

const render = (s: Scenario) => {
  s.tick();
  s.flush();
};

const leave = (s: Scenario, field: HTMLInputElement) => {
  field.blur();
  s.tick();
};

describe('forms form-field scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  it('names the control by its label and describes it by the hint until a touched error takes over', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SignupComponent);
    const host = fixture.nativeElement as HTMLElement;

    render(s);

    const field = query<HTMLInputElement>('input', host);
    const label = query('et-label', host);

    expect(field.getAttribute('aria-labelledby')).toBe(label.id);
    expect(query('.et-label-required-marker', label).getAttribute('aria-hidden')).toBe('true');
    expect(describedBy(field)?.textContent).toContain('We never share it.');
    expect(describedBy(field)?.classList).toContain('et-form-field-hint');
    expect(host.querySelector('et-form-error')).toBeNull();
    expect(field.hasAttribute('aria-invalid')).toBe(false);

    field.focus();
    leave(s, field);

    const errors = describedBy(field);

    expect(errors?.textContent).toContain('Email is required');
    expect(errors?.getAttribute('aria-live')).toBe('polite');
    expect(errors?.classList).toContain('et-form-field-errors');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(query('et-form-field', host).hasAttribute('data-error')).toBe(true);

    type(s, field, 'not-an-email');
    expect(describedBy(field)?.textContent).toContain('Not an email address');

    type(s, field, 'me@example.com');
    expect(describedBy(field)?.classList).toContain('et-form-field-hint');
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(query('et-form-field', host).hasAttribute('data-error')).toBe(false);
    render(s);
  });
  it('removes the error region once its exit finished, leaving only the hint', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SignupComponent);
    const host = fixture.nativeElement as HTMLElement;

    render(s);

    const field = query<HTMLInputElement>('input', host);

    field.focus();
    leave(s, field);
    expect(host.querySelector('.et-form-field-errors')).not.toBeNull();

    type(s, field, 'me@example.com');
    render(s);

    const leaving = query('.et-form-field-errors', host);

    expect(leaving.getAttribute('data-state')).toBe('leaving');
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(leaving.hasAttribute('aria-live')).toBe(false);
    expect(leaving.textContent).toContain('Email is required');
    expect(query('.et-form-field-hint', host).hasAttribute('aria-hidden')).toBe(false);

    leaving.dispatchEvent(new Event('animationstart'));
    leaving.dispatchEvent(new Event('animationend'));
    render(s);

    expect(host.querySelector('.et-form-field-errors')).toBeNull();
  });

  it('keeps an invalid field quiet until it is touched, by the user or by the form', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SignupComponent);
    const host = fixture.nativeElement as HTMLElement;
    const signup = fixture.componentInstance.signup;

    render(s);

    const field = query<HTMLInputElement>('input', host);

    type(s, field, 'half');
    expect(signup.email().invalid()).toBe(true);
    expect(host.querySelector('et-form-error')).toBeNull();
    expect(fixture.componentInstance.formFieldDir().shouldDisplayError()).toBe(false);

    signup.email().markAsTouched();
    render(s);

    expect(query('et-form-error', host).textContent).toContain('Not an email address');
    expect(fixture.componentInstance.formField().support.displaysError()).toBe(true);
    expect(fixture.componentInstance.formFieldDir().describedById()).toBe(field.getAttribute('aria-describedby'));
  });

  it('projects prefix and suffix into the shell and forwards clicks on the blank frame and label to the input', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SignupComponent);
    const host = fixture.nativeElement as HTMLElement;

    render(s);

    const field = query<HTMLInputElement>('input', host);
    const suffixButton = query<HTMLButtonElement>('.email-suffix', host);

    expect(query('.et-form-field-prefix', host).textContent).toContain('@');
    expect(query('.et-form-field-suffix', host).contains(suffixButton)).toBe(true);
    expect(query('[etInputPrefix]', host).closest('.et-form-field-control-frame')).not.toBeNull();

    const suffixDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    suffixButton.dispatchEvent(suffixDown);
    expect(suffixDown.defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(field);

    const frameDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    query('.et-form-field-prefix', host).dispatchEvent(frameDown);
    s.tick();
    expect(frameDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field);

    field.blur();
    query('et-label', host).click();
    s.tick();
    expect(document.activeElement).toBe(field);
    render(s);
  });

  it('mirrors disabled, readonly and hidden schema rules onto the native input and the field', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileComponent);
    const host = fixture.nativeElement as HTMLElement;
    const profile = fixture.componentInstance;

    render(s);

    const field = query<HTMLInputElement>('input', host);
    const formField = query('et-form-field', host);

    expect(formField.hasAttribute('data-disabled')).toBe(false);

    profile.locked.set(true);
    render(s);

    expect(field.disabled).toBe(true);
    expect(formField.hasAttribute('data-disabled')).toBe(true);
    expect(query('et-label', host).hasAttribute('data-disabled')).toBe(true);

    query('et-label', host).click();
    s.tick();
    expect(document.activeElement).not.toBe(field);

    profile.locked.set(false);
    profile.frozen.set(true);
    render(s);

    expect(field.disabled).toBe(false);
    expect(field.readOnly).toBe(true);
    expect(formField.hasAttribute('data-readonly')).toBe(true);

    profile.gone.set(true);
    render(s);
    expect(formField.style.display).toBe('none');
    s.expectWarning(/NG01916/);

    profile.gone.set(false);
    render(s);
    expect(formField.style.display).toBe('');
  });

  it('counts towards the schema maxLength and flags the overflow as an error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileComponent);
    const host = fixture.nativeElement as HTMLElement;

    render(s);

    const field = query<HTMLInputElement>('input', host);
    const counter = query('et-counter', host);

    expect(counter.textContent).toContain('0 / 10');
    expect(fixture.componentInstance.counter().resolvedMax()).toBe(10);

    type(s, field, 'nine char');
    expect(counter.textContent).toContain('9 / 10');
    expect(query('.et-counter-announcement', counter).textContent?.trim()).toBe('1 characters remaining');

    type(s, field, 'eleven char');
    leave(s, field);

    expect(counter.hasAttribute('data-over-limit')).toBe(true);
    expect(query('.et-counter-announcement', counter).textContent?.trim()).toBe('1 characters over the limit of 10');
    expect(query('et-form-error', host).textContent).toContain('At most 10 characters');
    render(s);
  });

  it('shows a warn() advisory under a valid field and yields the slot to an error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileComponent);
    const host = fixture.nativeElement as HTMLElement;
    const profile = fixture.componentInstance.profile;

    render(s);

    const field = query<HTMLInputElement>('input', host);

    type(s, field, 'LOUD');
    leave(s, field);

    const warning = describedBy(field);

    expect(warning?.classList).toContain('et-form-field-warnings');
    expect(query('et-form-warning', host).textContent).toContain('That reads as shouting.');
    expect(query('et-form-field', host).hasAttribute('data-warning')).toBe(true);
    expect(profile.nickname().valid()).toBe(true);
    expect(field.hasAttribute('aria-invalid')).toBe(false);

    type(s, field, 'VERY LOUD NAME');
    render(s);

    expect(describedBy(field)?.classList).toContain('et-form-field-errors');
    expect(query('.et-form-field-warnings', host).getAttribute('data-state')).toBe('leaving');
    expect(query('.et-form-field-warnings', host).getAttribute('data-direction')).toBe('to-above');
    expect(query('.et-form-field-errors', host).getAttribute('data-direction')).toBe('from-below');

    type(s, field, 'calm');
    render(s);
    expect(field.hasAttribute('aria-describedby')).toBe(false);
    expect(query('.et-form-field-errors', host).getAttribute('data-state')).toBe('leaving');
  });

  it('reflects the appearance, fill, label mode, size and busy inputs on the host', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileComponent);
    const host = fixture.nativeElement as HTMLElement;
    const profile = fixture.componentInstance;

    render(s);

    const formField = query('et-form-field', host);

    expect(formField.getAttribute('data-appearance')).toBe('box');
    expect(formField.getAttribute('data-fill')).toBe('transparent');
    expect(formField.getAttribute('data-label-mode')).toBe('static');
    expect(formField.getAttribute('data-size')).toBe('md');
    expect(formField.hasAttribute('data-label-floated')).toBe(false);

    profile.appearance.set(FORM_FIELD_APPEARANCES.UNDERLINE);
    profile.fill.set(FORM_FIELD_FILLS.FILLED);
    profile.labelMode.set(FORM_FIELD_LABEL_MODES.FLOATING_INSIDE);
    profile.size.set(FORM_FIELD_SIZES.LG);
    profile.busy.set(true);
    render(s);

    expect(formField.getAttribute('data-appearance')).toBe('underline');
    expect(formField.getAttribute('data-fill')).toBe('filled');
    expect(formField.getAttribute('data-label-mode')).toBe('floating-inside');
    expect(formField.getAttribute('data-size')).toBe('lg');
    expect(formField.getAttribute('aria-busy')).toBe('true');
    expect(query('.et-form-field-label-area', host).classList).toContain('et-form-field-label-area--floating');
    expect(formField.hasAttribute('data-label-floated')).toBe(false);

    type(s, query<HTMLInputElement>('input', host), 'Ace');
    expect(formField.hasAttribute('data-label-floated')).toBe(true);

    profile.busy.set(false);
    render(s);
    expect(formField.hasAttribute('aria-busy')).toBe(false);
  });

  it('names a label-less control by its own aria-label, lets aria-labelledby beat the label, and shows [warnings]', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SearchComponent);
    const host = fixture.nativeElement as HTMLElement;

    render(s);

    const [search, other] = Array.from(host.querySelectorAll('input'));

    expect(search?.getAttribute('aria-label')).toBe('Search');
    expect(search?.hasAttribute('aria-labelledby')).toBe(false);
    expect(other?.getAttribute('aria-labelledby')).toBe('search-caption');
    expect(host.querySelector('et-form-field')?.hasAttribute('data-has-label')).toBe(false);

    fixture.componentInstance.advice.set('Try fewer words.');
    render(s);

    expect(search ? describedBy(search)?.textContent : null).toContain('Try fewer words.');
    expect(query('et-form-warning', host).textContent?.trim()).toBe('Try fewer words.');
  });

  it('reports a field without a control and a control without an accessible name in dev mode', () => {
    const s = scenario();

    TestBed.createComponent(EmptyFieldComponent);
    s.tick(1);
    s.expectError(new RegExp(String(FORM_FIELD_ERROR_CODES.MISSING_CONTROL)));

    TestBed.createComponent(UnnamedFieldComponent);
    s.tick(1);
    s.expectError(new RegExp(String(FORM_FIELD_ERROR_CODES.MISSING_LABEL)));
    s.errors.splice(0);
    render(s);
  });

  it('shows the error of a reactive FormGroup control bound through SignalFormControl', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LegacyFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const legacy = fixture.componentInstance;

    render(s);

    const field = query<HTMLInputElement>('input', host);

    expect(legacy.group.valid).toBe(false);
    expect(query('.et-label-required-marker', host)).toBeTruthy();

    field.focus();
    leave(s, field);

    expect(legacy.city.touched).toBe(true);
    expect(describedBy(field)?.textContent).toContain('City is required');

    type(s, field, 'Springfield');
    render(s);

    expect(legacy.group.value).toEqual({ city: 'Springfield' });
    expect(legacy.group.valid).toBe(true);
    expect(field.hasAttribute('aria-invalid')).toBe(false);

    legacy.city.setValue('');
    render(s);
    expect(field.value).toBe('');
    expect(describedBy(field)?.textContent).toContain('City is required');
  });
});

describe('forms form-field localized scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemes(TEST_COLOR_THEMES),
      provideFormFieldLabels({ mixed: 'Gemischt' }),
      provideFormErrorMessageResolver((error) => {
        if (error.kind === 'required') return 'Pflichtfeld';
        if (error.kind === 'minlength') return 'Zu kurz';
        return null;
      }),
      provideFormWarningMessageResolver((warning) =>
        warning.kind === 'longStreet' ? 'Ungewöhnlich lange Straße' : null,
      ),
    ],
  });

  it('shows the app-wide mixed placeholder and resolves reactive validator errors by kind', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BulkEditComponent);
    const host = fixture.nativeElement as HTMLElement;
    const bulk = fixture.componentInstance;

    render(s);

    const [street, zip] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));

    if (!street || !zip) throw new Error('no inputs');

    expect(bulk.labels()).toEqual({ ...DEFAULT_FORM_FIELD_LABELS, mixed: 'Gemischt' });
    expect(bulk.labelsToken).toEqual({ mixed: 'Gemischt' });
    expect(street.value).toBe('');
    expect(street.placeholder).toBe('Gemischt');

    type(s, street, 'Elm St');
    expect(bulk.mixed()).toBe(false);
    expect(bulk.model().street).toBe('Elm St');

    zip.focus();
    leave(s, zip);

    expect(bulk.zip.touched).toBe(true);
    expect(describedBy(zip)?.textContent?.trim()).toBe('Pflichtfeld');
    expect(componentOf(fixture, FormErrorComponent).error().kind).toBe('required');

    type(s, zip, '123');
    expect(describedBy(zip)?.textContent?.trim()).toBe('Zu kurz');
    expect(bulk.errorResolver({ kind: 'minlength' })).toBe('Zu kurz');

    type(s, zip, '12345');
    render(s);
    expect(bulk.zip.value).toBe('12345');
    expect(zip.hasAttribute('aria-invalid')).toBe(false);
  });

  it('resolves warning texts by kind and falls back to the message of a bare-string warning', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BulkEditComponent);
    const host = fixture.nativeElement as HTMLElement;
    const bulk = fixture.componentInstance;

    render(s);

    const [street, , note] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));

    if (!street || !note) throw new Error('no inputs');

    type(s, street, 'A very long street name indeed');
    render(s);
    expect(describedBy(street)?.textContent?.trim()).toBe('Ungewöhnlich lange Straße');
    expect(componentOf(fixture, FormWarningComponent).warning()).toEqual({ kind: 'longStreet' });

    bulk.noteWarnings.set('Keep it short.');
    render(s);
    expect(describedBy(note)?.textContent?.trim()).toBe('Keep it short.');
    expect(bulk.warningResolver({ kind: FIELD_WARNING_KIND, message: 'x' })).toBeNull();
  });
});
